import type { FarcasterQueryParams } from "shared";
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import type {
  LlmFidConfig,
  FetchOptions,
  FetchResult,
  ServerEstimate,
  EvmSigner,
} from "./types";
import { getDefaultBaseUrl, DEFAULT_TIMEOUT } from "./config";

// Free tier configuration (must match server)
const FREE_TIER = {
  maxLimit: 10,
};

/**
 * Check if request qualifies for free tier (quick client-side check)
 */
function isFreeTier(options: FetchOptions): boolean {
  const limit = options.limit || 50;
  if (limit > FREE_TIER.maxLimit) return false;
  if (options.all) return false;
  if (options.includeReplies) return false;
  if (options.includeParents) return false;
  return true;
}

/**
 * Create a fingerprint of pricing-relevant params for caching
 * Only these params affect the price, so we only re-fetch when they change
 */
function getPricingFingerprint(options: FetchOptions): string {
  const parts = [
    options.fid?.toString() || options.username || "",
    options.all ? "all" : (options.limit || 50).toString(),
    options.includeReplies ? "r" : "",
    options.includeParents ? "p" : "",
    options.includeReactions ? "x" : "",
  ];
  return parts.join("|");
}

const DEFAULT_BASE_URL = getDefaultBaseUrl();

/**
 * Build query string from options
 */
function buildQueryString(options: FetchOptions): string {
  const params = new URLSearchParams();

  if (options.fid) {
    params.set("fid", options.fid.toString());
  }
  if (options.username) {
    params.set("username", options.username.toLowerCase().replace(/^@/, ""));
  }
  if (options.limit && !options.all) {
    params.set("limit", options.limit.toString());
  }
  if (options.all) {
    params.set("all", "true");
  }
  if (options.includeReplies) {
    params.set("includeReplies", "true");
  }
  if (options.includeParents) {
    params.set("includeParents", "true");
  }
  if (options.sortOrder && options.sortOrder !== "newest") {
    params.set("sortOrder", options.sortOrder);
  }
  if (options.includeReactions) {
    params.set("includeReactions", "true");
  }

  return params.toString();
}

// Type for the fetch function (compatible with x402-fetch return type)
type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Create a payment-enabled fetch function using x402
 */
function createPaymentFetch(
  baseFetch: FetchFn,
  signer: EvmSigner
): FetchFn {
  const client = new x402Client();
  registerExactEvmScheme(client, { signer });
  const wrappedFetch = wrapFetchWithPayment(baseFetch as typeof globalThis.fetch, client);
  // Wrap to handle URL type conversion
  return (input: RequestInfo | URL, init?: RequestInit) =>
    wrappedFetch(input instanceof URL ? input.toString() : input, init);
}

/**
 * LLM-FID SDK Client
 *
 * Provides access to the llm-fid.fun API with built-in x402 payment handling,
 * URL building, and price estimation.
 *
 * @example
 * ```ts
 * import { LlmFidClient } from "@llm-txt/sdk";
 *
 * // With automatic payments (pass a viem WalletClient)
 * const client = new LlmFidClient({ signer: walletClient });
 *
 * // Or without payments (free tier only)
 * const client = new LlmFidClient();
 *
 * // Get the URL for a query
 * const url = client.getUrl({ username: "vitalik", limit: 100 });
 *
 * // Get server price estimate
 * const estimate = await client.getServerEstimate({ username: "vitalik", all: true });
 * console.log(estimate?.price);
 *
 * // Fetch data (payments handled automatically if signer provided)
 * const result = await client.fetch({ username: "vitalik", limit: 10 });
 * console.log(result.text);
 * ```
 */
export class LlmFidClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly fetchFn: FetchFn;
  private readonly baseFetchFn: FetchFn;
  private readonly hasSigner: boolean;

  // Cache for server estimates (fingerprint -> estimate)
  private estimateCache = new Map<string, { estimate: ServerEstimate; timestamp: number }>();
  private readonly ESTIMATE_CACHE_TTL = 60000; // 1 minute

  constructor(config: LlmFidConfig = {}) {
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
    this.hasSigner = !!config.signer;

    // Bind fetch to globalThis to avoid "Illegal invocation" in browsers
    this.baseFetchFn = config.fetch || globalThis.fetch.bind(globalThis);

    // Wrap with x402 payment handling if signer is provided
    this.fetchFn = config.signer
      ? createPaymentFetch(this.baseFetchFn, config.signer)
      : this.baseFetchFn;
  }

  /**
   * Fetch Farcaster data for a user
   *
   * If a signer was provided to the constructor, x402 payments are handled automatically.
   * Otherwise, requests that exceed the free tier will return 402 status.
   *
   * @param options Query options (fid or username required)
   * @returns The fetch result with text and status
   * @throws Error if payment is required but no signer was provided
   */
  async fetch(options: FetchOptions): Promise<FetchResult> {
    if (!options.fid && !options.username) {
      throw new Error("Either fid or username is required");
    }

    const queryString = buildQueryString(options);
    const url = `${this.baseUrl}?${queryString}`;

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await this.fetchFn(url, {
        signal: controller.signal,
        headers: {
          Accept: "text/plain",
        },
      });

      clearTimeout(timeoutId);

      const text = await response.text();
      return {
        text,
        status: response.status,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(
          "Request timed out. Try reducing the number of posts or disable 'Fetch All'."
        );
      }

      throw error;
    }
  }

  /**
   * Get the URL for a query (useful for direct browser access or debugging)
   */
  getUrl(options: FetchOptions): string {
    const queryString = buildQueryString(options);
    return `${this.baseUrl}?${queryString}`;
  }

  /**
   * Get price estimate from server (authoritative source)
   * Results are cached by pricing-relevant params fingerprint.
   *
   * @param options Query options
   * @returns Price estimate from server, or null on error
   */
  async getServerEstimate(options: FetchOptions): Promise<ServerEstimate | null> {
    // Quick check for free tier - no need to call server
    if (isFreeTier(options)) {
      return { price: "$0", isFree: true, castCount: null };
    }

    // Check cache first
    const fingerprint = getPricingFingerprint(options);
    const cached = this.estimateCache.get(fingerprint);
    if (cached && Date.now() - cached.timestamp < this.ESTIMATE_CACHE_TTL) {
      return cached.estimate;
    }

    try {
      const queryString = buildQueryString(options);
      // Use baseFetchFn - estimate endpoint doesn't need payment handling
      const response = await this.baseFetchFn(`${this.baseUrl}/estimate?${queryString}`, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) return null;

      const estimate = await response.json() as ServerEstimate;

      // Cache the result
      this.estimateCache.set(fingerprint, { estimate, timestamp: Date.now() });

      return estimate;
    } catch {
      return null;
    }
  }

  /**
   * Check if options would qualify for free tier (quick local check)
   */
  isFreeTier(options: FetchOptions): boolean {
    return isFreeTier(options);
  }
}
