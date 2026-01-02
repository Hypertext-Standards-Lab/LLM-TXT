import type { GitQueryParams } from "shared";
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import type { FetchResult, EvmSigner } from "./types";
import { getDefaultBaseUrl, DEFAULT_TIMEOUT } from "./config";

// Free tier configuration (must match server)
const GIT_FREE_TIER = {
  maxFiles: 10,
};

export interface LlmGitConfig {
  baseUrl?: string;
  timeout?: number;
  signer?: EvmSigner;
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

export type GitFetchOptions = GitQueryParams;

export interface GitServerEstimate {
  price: string;
  isFree: boolean;
  repoSize: number | null;
  fileCount: number | null;
}

function isFreeTier(options: GitFetchOptions): boolean {
  if (options.includeContent) return false;
  // Basic tree with less than 10 files is free
  return !options.includeTree;
}

function getPricingFingerprint(options: GitFetchOptions): string {
  const parts = [
    options.url || "",
    options.includeTree ? "t" : "",
    options.includeContent ? "c" : "",
    options.branch || "",
    options.includePatterns?.join(";") || "",
    options.excludePatterns?.join(";") || "",
  ];
  return parts.join("|");
}

const DEFAULT_BASE_URL = getDefaultBaseUrl();

function buildQueryString(options: GitFetchOptions): string {
  const params = new URLSearchParams();

  if (options.url) {
    params.set("url", options.url);
  }
  if (options.branch) {
    params.set("branch", options.branch);
  }
  if (options.includeTree) {
    params.set("includeTree", "true");
  }
  if (options.includeContent) {
    params.set("includeContent", "true");
  }
  if (options.maxFileSize) {
    params.set("maxFileSize", options.maxFileSize.toString());
  }
  if (options.includePatterns?.length) {
    params.set("include", options.includePatterns.join(","));
  }
  if (options.excludePatterns?.length) {
    params.set("exclude", options.excludePatterns.join(","));
  }

  return params.toString();
}

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function createPaymentFetch(baseFetch: FetchFn, signer: EvmSigner): FetchFn {
  const client = new x402Client();
  registerExactEvmScheme(client, { signer });
  const wrappedFetch = wrapFetchWithPayment(baseFetch as typeof globalThis.fetch, client);
  return (input: RequestInfo | URL, init?: RequestInit) =>
    wrappedFetch(input instanceof URL ? input.toString() : input, init);
}

/**
 * LLM-Git SDK Client
 *
 * Provides access to the llm-fid.fun Git API with built-in x402 payment handling.
 */
export class LlmGitClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly fetchFn: FetchFn;
  private readonly baseFetchFn: FetchFn;
  private readonly hasSigner: boolean;

  private estimateCache = new Map<string, { estimate: GitServerEstimate; timestamp: number }>();
  private readonly ESTIMATE_CACHE_TTL = 60000;

  constructor(config: LlmGitConfig = {}) {
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
    this.hasSigner = !!config.signer;

    this.baseFetchFn = config.fetch || globalThis.fetch.bind(globalThis);
    this.fetchFn = config.signer
      ? createPaymentFetch(this.baseFetchFn, config.signer)
      : this.baseFetchFn;
  }

  async fetch(options: GitFetchOptions): Promise<FetchResult> {
    if (!options.url) {
      throw new Error("url is required");
    }

    const queryString = buildQueryString(options);
    const url = `${this.baseUrl}/git?${queryString}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await this.fetchFn(url, {
        signal: controller.signal,
        headers: { Accept: "text/plain" },
      });

      clearTimeout(timeoutId);

      const text = await response.text();
      return { text, status: response.status };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Request timed out. Large repositories may take longer to process.");
      }

      throw error;
    }
  }

  getUrl(options: GitFetchOptions): string {
    const queryString = buildQueryString(options);
    return `${this.baseUrl}/git?${queryString}`;
  }

  async getServerEstimate(options: GitFetchOptions): Promise<GitServerEstimate | null> {
    if (isFreeTier(options)) {
      return { price: "$0", isFree: true, repoSize: null, fileCount: null };
    }

    const fingerprint = getPricingFingerprint(options);
    const cached = this.estimateCache.get(fingerprint);
    if (cached && Date.now() - cached.timestamp < this.ESTIMATE_CACHE_TTL) {
      return cached.estimate;
    }

    try {
      const queryString = buildQueryString(options);
      const response = await this.baseFetchFn(`${this.baseUrl}/git/estimate?${queryString}`, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) return null;

      const estimate = await response.json() as GitServerEstimate;
      this.estimateCache.set(fingerprint, { estimate, timestamp: Date.now() });

      return estimate;
    } catch {
      return null;
    }
  }

  isFreeTier(options: GitFetchOptions): boolean {
    return isFreeTier(options);
  }
}
