import type { RssQueryParams } from "shared";
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import type { FetchResult, EvmSigner } from "./types";
import { getDefaultBaseUrl, DEFAULT_TIMEOUT } from "./config";

// Free tier configuration (must match server)
const RSS_FREE_TIER = {
  maxItems: 5,
};

export interface LlmRssConfig {
  baseUrl?: string;
  timeout?: number;
  signer?: EvmSigner;
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

export type RssFetchOptions = RssQueryParams;

export interface RssServerEstimate {
  price: string;
  isFree: boolean;
  itemCount: number | null;
}

function isFreeTier(options: RssFetchOptions): boolean {
  const limit = options.limit || 10;
  if (limit > RSS_FREE_TIER.maxItems) return false;
  if (options.all) return false;
  if (options.includeContent) return false;
  return true;
}

function getPricingFingerprint(options: RssFetchOptions): string {
  const parts = [
    options.url || "",
    options.all ? "all" : (options.limit || 10).toString(),
    options.includeContent ? "c" : "",
  ];
  return parts.join("|");
}

const DEFAULT_BASE_URL = getDefaultBaseUrl();

function buildQueryString(options: RssFetchOptions): string {
  const params = new URLSearchParams();

  if (options.url) {
    params.set("url", options.url);
  }
  if (options.limit && !options.all) {
    params.set("limit", options.limit.toString());
  }
  if (options.all) {
    params.set("all", "true");
  }
  if (options.includeContent) {
    params.set("includeContent", "true");
  }
  if (options.sortOrder && options.sortOrder !== "newest") {
    params.set("sortOrder", options.sortOrder);
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
 * LLM-RSS SDK Client
 *
 * Provides access to the llm-fid.fun RSS API with built-in x402 payment handling.
 */
export class LlmRssClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly fetchFn: FetchFn;
  private readonly baseFetchFn: FetchFn;
  private readonly hasSigner: boolean;

  private estimateCache = new Map<string, { estimate: RssServerEstimate; timestamp: number }>();
  private readonly ESTIMATE_CACHE_TTL = 60000;

  constructor(config: LlmRssConfig = {}) {
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
    this.hasSigner = !!config.signer;

    this.baseFetchFn = config.fetch || globalThis.fetch.bind(globalThis);
    this.fetchFn = config.signer
      ? createPaymentFetch(this.baseFetchFn, config.signer)
      : this.baseFetchFn;
  }

  async fetch(options: RssFetchOptions): Promise<FetchResult> {
    if (!options.url) {
      throw new Error("url is required");
    }

    const queryString = buildQueryString(options);
    const url = `${this.baseUrl}/rss?${queryString}`;

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
        throw new Error("Request timed out.");
      }

      throw error;
    }
  }

  getUrl(options: RssFetchOptions): string {
    const queryString = buildQueryString(options);
    return `${this.baseUrl}/rss?${queryString}`;
  }

  async getServerEstimate(options: RssFetchOptions): Promise<RssServerEstimate | null> {
    if (isFreeTier(options)) {
      return { price: "$0", isFree: true, itemCount: null };
    }

    const fingerprint = getPricingFingerprint(options);
    const cached = this.estimateCache.get(fingerprint);
    if (cached && Date.now() - cached.timestamp < this.ESTIMATE_CACHE_TTL) {
      return cached.estimate;
    }

    try {
      const queryString = buildQueryString(options);
      const response = await this.baseFetchFn(`${this.baseUrl}/rss/estimate?${queryString}`, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) return null;

      const estimate = await response.json() as RssServerEstimate;
      this.estimateCache.set(fingerprint, { estimate, timestamp: Date.now() });

      return estimate;
    } catch {
      return null;
    }
  }

  isFreeTier(options: RssFetchOptions): boolean {
    return isFreeTier(options);
  }
}
