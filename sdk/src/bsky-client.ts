import type { BlueskyQueryParams } from "shared";
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import type {
  LlmBskyConfig,
  BskyFetchOptions,
  FetchResult,
  BskyServerEstimate,
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
function isFreeTier(options: BskyFetchOptions): boolean {
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
function getPricingFingerprint(options: BskyFetchOptions): string {
  const parts = [
    options.did || options.handle || "",
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
function buildQueryString(options: BskyFetchOptions): string {
  const params = new URLSearchParams();

  if (options.did) {
    params.set("did", options.did);
  }
  if (options.handle) {
    params.set("handle", options.handle.toLowerCase().replace(/^@/, ""));
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
 * LLM-BSKY SDK Client
 *
 * Provides access to the llm-fid.fun Bluesky API with built-in x402 payment handling,
 * URL building, and price estimation.
 *
 * @example
 * ```ts
 * import { LlmBskyClient } from "@llm-txt/sdk";
 *
 * // With automatic payments (pass a viem WalletClient)
 * const client = new LlmBskyClient({ signer: walletClient });
 *
 * // Or without payments (free tier only)
 * const client = new LlmBskyClient();
 *
 * // Get the URL for a query
 * const url = client.getUrl({ handle: "user.bsky.social", limit: 100 });
 *
 * // Get server price estimate
 * const estimate = await client.getServerEstimate({ handle: "user.bsky.social", all: true });
 * console.log(estimate?.price);
 *
 * // Fetch data (payments handled automatically if signer provided)
 * const result = await client.fetch({ handle: "user.bsky.social", limit: 10 });
 * console.log(result.text);
 * ```
 */
export class LlmBskyClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly fetchFn: FetchFn;
  private readonly baseFetchFn: FetchFn;
  private readonly hasSigner: boolean;

  // Cache for server estimates (fingerprint -> estimate)
  private estimateCache = new Map<string, { estimate: BskyServerEstimate; timestamp: number }>();
  private readonly ESTIMATE_CACHE_TTL = 60000; // 1 minute

  constructor(config: LlmBskyConfig = {}) {
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
   * Fetch Bluesky data for a user
   *
   * If a signer was provided to the constructor, x402 payments are handled automatically.
   * Otherwise, requests that exceed the free tier will return 402 status.
   *
   * @param options Query options (handle or did required)
   * @returns The fetch result with text and status
   * @throws Error if payment is required but no signer was provided
   */
  async fetch(options: BskyFetchOptions): Promise<FetchResult> {
    if (!options.did && !options.handle) {
      throw new Error("Either did or handle is required");
    }

    const queryString = buildQueryString(options);
    const url = `${this.baseUrl}/bsky?${queryString}`;

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
  getUrl(options: BskyFetchOptions): string {
    const queryString = buildQueryString(options);
    return `${this.baseUrl}/bsky?${queryString}`;
  }

  /**
   * Get price estimate from server (authoritative source)
   * Results are cached by pricing-relevant params fingerprint.
   *
   * @param options Query options
   * @returns Price estimate from server, or null on error
   */
  async getServerEstimate(options: BskyFetchOptions): Promise<BskyServerEstimate | null> {
    // Quick check for free tier - no need to call server
    if (isFreeTier(options)) {
      return { price: "$0", isFree: true, postCount: null };
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
      const response = await this.baseFetchFn(`${this.baseUrl}/bsky/estimate?${queryString}`, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) return null;

      const estimate = await response.json() as BskyServerEstimate;

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
  isFreeTier(options: BskyFetchOptions): boolean {
    return isFreeTier(options);
  }
}
