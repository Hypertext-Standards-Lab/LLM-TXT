import type { FarcasterQueryParams, FarcasterResponse, BlueskyQueryParams, BlueskyResponse, RssQueryParams, RssResponse, GitQueryParams, GitResponse } from "shared";

/**
 * EVM signer interface compatible with viem WalletClient
 * This is used to sign x402 payment authorizations
 */
export interface EvmSigner {
  readonly address: `0x${string}`;
  signTypedData(message: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<`0x${string}`>;
}

/**
 * SDK Configuration
 */
export interface LlmFidConfig {
  /**
   * API base URL (default: https://api.llm-fid.fun)
   */
  baseUrl?: string;

  /**
   * Request timeout in milliseconds (default: 255000)
   */
  timeout?: number;

  /**
   * EVM signer for automatic x402 payments (e.g., viem WalletClient)
   * If provided, the SDK will automatically handle payment flows
   */
  signer?: EvmSigner;

  /**
   * Custom fetch function (for testing or custom implementations)
   * Note: If signer is provided, this fetch will be wrapped with payment handling
   */
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

/**
 * Query options for fetching Farcaster data
 */
export type FetchOptions = FarcasterQueryParams;

/**
 * Result of a fetch operation
 */
export interface FetchResult {
  /**
   * The raw text response (llm.txt format)
   */
  text: string;

  /**
   * HTTP status code
   */
  status: number;
}

/**
 * Server estimate response
 */
export interface ServerEstimate {
  /**
   * Estimated price as a dollar string (e.g., "$0.0015")
   */
  price: string;

  /**
   * Whether this request is in the free tier
   */
  isFree: boolean;

  /**
   * Total cast count for the user (null if not fetched)
   */
  castCount: number | null;
}

// ============================================================
// BLUESKY TYPES
// ============================================================

/**
 * SDK Configuration for Bluesky client
 */
export interface LlmBskyConfig {
  /**
   * API base URL (default: https://api.llm-fid.fun)
   */
  baseUrl?: string;

  /**
   * Request timeout in milliseconds (default: 255000)
   */
  timeout?: number;

  /**
   * EVM signer for automatic x402 payments (e.g., viem WalletClient)
   * If provided, the SDK will automatically handle payment flows
   */
  signer?: EvmSigner;

  /**
   * Custom fetch function (for testing or custom implementations)
   * Note: If signer is provided, this fetch will be wrapped with payment handling
   */
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

/**
 * Query options for fetching Bluesky data
 */
export type BskyFetchOptions = BlueskyQueryParams;

/**
 * Server estimate response for Bluesky
 */
export interface BskyServerEstimate {
  /**
   * Estimated price as a dollar string (e.g., "$0.0015")
   */
  price: string;

  /**
   * Whether this request is in the free tier
   */
  isFree: boolean;

  /**
   * Total post count for the user (null if not fetched)
   */
  postCount: number | null;
}
