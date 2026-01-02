// Environment-aware base URL detection
export function getDefaultBaseUrl(): string {
  // Check for explicit environment variable first
  if (typeof process !== "undefined" && process.env?.LLM_TXT_API_URL) {
    return process.env.LLM_TXT_API_URL;
  }

  // Browser: check for localhost/dev domains
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local")) {
      return "http://localhost:3000";
    }
  }

  // Node.js development detection
  if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
    return "http://localhost:3000";
  }

  // Default to production
  return "https://api.llm-fid.fun";
}

export const DEFAULT_TIMEOUT = 255000; // 4.25 minutes
