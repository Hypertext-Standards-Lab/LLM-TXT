/**
 * Unit tests for LlmFidClient
 */
import { describe, test, expect } from "bun:test";
import { LlmFidClient } from "../src/client";

describe("LlmFidClient", () => {
  describe("constructor", () => {
    test("creates client with default config", () => {
      const client = new LlmFidClient();
      expect(client).toBeDefined();
    });

    test("creates client with custom baseUrl", () => {
      const client = new LlmFidClient({ baseUrl: "https://custom.api.com" });
      expect(client.getUrl({ username: "test" })).toStartWith("https://custom.api.com");
    });
  });

  describe("getUrl", () => {
    const client = new LlmFidClient({ baseUrl: "https://api.test.com" });

    test("builds URL with username", () => {
      const url = client.getUrl({ username: "vitalik" });
      expect(url).toBe("https://api.test.com?username=vitalik");
    });

    test("builds URL with FID", () => {
      const url = client.getUrl({ fid: 3 });
      expect(url).toBe("https://api.test.com?fid=3");
    });

    test("normalizes username (lowercase, no @)", () => {
      const url = client.getUrl({ username: "@VitaliK" });
      expect(url).toBe("https://api.test.com?username=vitalik");
    });

    test("includes limit when not fetching all", () => {
      const url = client.getUrl({ username: "test", limit: 100 });
      expect(url).toContain("limit=100");
    });

    test("excludes limit when fetching all", () => {
      const url = client.getUrl({ username: "test", all: true, limit: 100 });
      expect(url).toContain("all=true");
      expect(url).not.toContain("limit=");
    });

    test("includes all optional params", () => {
      const url = client.getUrl({
        username: "test",
        limit: 50,
        includeReplies: true,
        includeParents: true,
        includeReactions: true,
        sortOrder: "oldest",
      });

      expect(url).toContain("includeReplies=true");
      expect(url).toContain("includeParents=true");
      expect(url).toContain("includeReactions=true");
      expect(url).toContain("sortOrder=oldest");
    });

    test("excludes default sortOrder (newest)", () => {
      const url = client.getUrl({ username: "test", sortOrder: "newest" });
      expect(url).not.toContain("sortOrder");
    });
  });

  describe("isFreeTier", () => {
    const client = new LlmFidClient();

    test("≤10 casts with no extras is free", () => {
      expect(client.isFreeTier({ username: "test", limit: 10 })).toBe(true);
    });

    test("5 casts is free", () => {
      expect(client.isFreeTier({ username: "test", limit: 5 })).toBe(true);
    });

    test("default limit (50) is NOT free", () => {
      expect(client.isFreeTier({ username: "test" })).toBe(false);
    });

    test("10 casts with replies is NOT free", () => {
      expect(client.isFreeTier({ username: "test", limit: 10, includeReplies: true })).toBe(false);
    });

    test("10 casts with parents is NOT free", () => {
      expect(client.isFreeTier({ username: "test", limit: 10, includeParents: true })).toBe(false);
    });

    test("fetch all is NOT free", () => {
      expect(client.isFreeTier({ username: "test", all: true })).toBe(false);
    });

    test("11 casts is NOT free", () => {
      expect(client.isFreeTier({ username: "test", limit: 11 })).toBe(false);
    });

    test("includeReactions does not affect free tier", () => {
      // Reactions don't require extra API calls, just more data
      expect(client.isFreeTier({ username: "test", limit: 10, includeReactions: true })).toBe(true);
    });
  });
});
