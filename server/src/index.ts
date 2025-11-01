import { Hono } from "hono";
import { cors } from "hono/cors";
import type { FarcasterResponse, FarcasterUser, FarcasterCast, FarcasterQueryParams } from "shared";
import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";

// Initialize Neynar SDK (handles rate limiting internally)
const client = new NeynarAPIClient(
  new Configuration({
    apiKey: process.env.NEYNAR_API_KEY || "",
  })
);

if (!process.env.NEYNAR_API_KEY) {
  throw new Error("NEYNAR_API_KEY environment variable is required");
}

// Simple cache - SDK handles its own caching
const cache = new Map<string, { data: any; expiry: number }>();

function getCached<T>(key: string): T | null {
  const item = cache.get(key);
  if (!item || Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCache<T>(key: string, data: T, ttl = 60000) {
  cache.set(key, { data, expiry: Date.now() + ttl });
}

// Rate limiter for Starter plan (300 RPM per endpoint, 500 RPM global)
class RateLimiter {
  private endpointRequests = new Map<string, number[]>();
  private globalRequests: number[] = [];
  private readonly ENDPOINT_LIMIT = 250; // Safety margin below 300 RPM
  private readonly GLOBAL_LIMIT = 450; // Safety margin below 500 RPM
  private readonly WINDOW_MS = 60000; // 1 minute

  private cleanOldRequests(requests: number[]): number[] {
    const now = Date.now();
    return requests.filter((timestamp) => now - timestamp < this.WINDOW_MS);
  }

  async waitForSlot(endpoint: string): Promise<void> {
    const now = Date.now();

    // Clean old requests
    this.globalRequests = this.cleanOldRequests(this.globalRequests);
    const endpointReqs = this.cleanOldRequests(this.endpointRequests.get(endpoint) || []);
    this.endpointRequests.set(endpoint, endpointReqs);

    // Check if we're at limits
    const globalCount = this.globalRequests.length;
    const endpointCount = endpointReqs.length;

    if (globalCount >= this.GLOBAL_LIMIT || endpointCount >= this.ENDPOINT_LIMIT) {
      // Calculate wait time until oldest request expires
      const relevantRequests =
        globalCount >= this.GLOBAL_LIMIT
          ? this.globalRequests
          : endpointReqs;

      const oldestRequest = relevantRequests[0];
      if (!oldestRequest) {
        // Shouldn't happen, but safety check
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return this.waitForSlot(endpoint);
      }

      const waitTime = this.WINDOW_MS - (now - oldestRequest) + 100; // +100ms buffer

      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return this.waitForSlot(endpoint); // Retry after waiting
    }

    // Record this request
    this.globalRequests.push(now);
    endpointReqs.push(now);
    this.endpointRequests.set(endpoint, endpointReqs);
  }
}

const rateLimiter = new RateLimiter();

// Resolve username to FID
async function resolveFid(username: string): Promise<number> {
  const normalized = username.toLowerCase().replace(/^@/, "");
  const cached = getCached<number>(`fid:${normalized}`);
  if (cached) return cached;

  const { user } = await client.lookupUserByUsername({ username: normalized });
  if (!user?.fid) throw new Error(`User not found: ${username}`);

  setCache(`fid:${normalized}`, user.fid, 300000); // 5 min
  return user.fid;
}

// Transform SDK responses
function transformUser(u: any): FarcasterUser {
  return {
    fid: u.fid,
    username: u.username,
    displayName: u.display_name || "",
    bio: u.profile?.bio?.text || "",
    pfp: u.pfp_url || "",
    url: "",
    location: "",
    twitter: "",
    github: "",
  };
}

function transformCast(c: any): FarcasterCast {
  return {
    hash: c.hash,
    threadHash: c.thread_hash,
    parentHash: c.parent_hash || undefined,
    author: { fid: c.author.fid, username: c.author.username || "" },
    text: c.text,
    timestamp: c.timestamp,
    attachments: [],
    embeds: c.embeds?.map((e: any) => ({ type: "url", url: e.url })) || [],
    reactions: {
      likes: c.reactions?.likes_count || 0,
      recasts: c.reactions?.recasts_count || 0,
    },
  };
}

// Main fetch function
async function fetchUserData(
  fidOrUsername: number | string,
  params: FarcasterQueryParams
): Promise<FarcasterResponse & { params?: FarcasterQueryParams }> {
  const fid = typeof fidOrUsername === "number" ? fidOrUsername : await resolveFid(fidOrUsername);

  // Get user
  const { users } = await client.fetchBulkUsers({ fids: [fid] });
  if (!users?.[0]) throw new Error(`User not found: ${fid}`);
  const user = transformUser(users[0]);

  // Get casts
  const casts = await fetchCasts(fid, params);

  return { user, casts, params };
}

async function fetchCasts(fid: number, params: FarcasterQueryParams): Promise<FarcasterCast[]> {
  const fetchAll = params.all === true;
  const limit = fetchAll ? Infinity : (Number(params.limit) || 50);
  const includeReplies = params.includeReplies === true;
  const includeParents = params.includeParents === true;
  const sortOrder = params.sortOrder || "newest";

  const allCasts: FarcasterCast[] = [];
  let cursor: string | undefined;

  // Paginate through casts with rate limiting
  do {
    await rateLimiter.waitForSlot("/v2/farcaster/feed/user/casts");

    const res = await client.fetchCastsForUser({
      fid,
      limit: 150, // Always fetch max per request for efficiency
      cursor,
      includeReplies: includeReplies || undefined,
    });

    const filtered = (res.casts || [])
      .filter((c: any) => includeReplies || !c.parent_hash)
      .map(transformCast);

    allCasts.push(...filtered);
    cursor = res.next?.cursor || undefined;

    // Continue if fetching all, or until we reach the limit
  } while (cursor && (fetchAll || allCasts.length < limit));

  // Apply sort order if specified
  if (sortOrder === "oldest") {
    allCasts.reverse();
  }

  // Fetch parents if needed (with rate limiting)
  if (includeParents) {
    const parentHashes = [...new Set(allCasts.map((c) => c.parentHash).filter(Boolean))];
    const parentMap: Record<string, FarcasterCast> = {};

    // Process in larger batches with rate limiter (increased from 5 to 25)
    const batchSize = 25;
    for (let i = 0; i < parentHashes.length; i += batchSize) {
      const batch = parentHashes.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (hash) => {
          try {
            await rateLimiter.waitForSlot("/v2/farcaster/cast");
            const res = await client.lookupCastByHashOrUrl({
              identifier: hash!,
              type: "hash",
            });
            return [hash, res.cast ? transformCast(res.cast) : null] as const;
          } catch (err) {
            console.error(`Failed to fetch parent cast ${hash}:`, err);
            return [hash, null] as const;
          }
        })
      );

      results.forEach(([hash, cast]) => {
        if (cast) parentMap[hash as string] = cast;
      });
    }

    allCasts.forEach((c) => {
      if (c.parentHash && parentMap[c.parentHash]) {
        c.parentCast = parentMap[c.parentHash];
      }
    });
  }

  // Return all casts if fetchAll is true, otherwise respect the limit
  return fetchAll ? allCasts : allCasts.slice(0, limit);
}

// Format output
function formatTextOutput(data: FarcasterResponse & { params?: FarcasterQueryParams }): string {
  const { user, casts, params } = data;
  const includeReactions = params?.includeReactions === true;

  let out = `Farcaster User Profile\n===================\n\n`;
  out += `Username: ${user.username}\n`;
  out += `Display Name: ${user.displayName || "N/A"}\n`;
  out += `FID: ${user.fid}\n`;
  if (user.bio) out += `Bio: ${user.bio}\n`;
  if (user.pfp) out += `Profile Picture: ${user.pfp}\n`;
  out += `\nPosts\n=====\n\n`;

  if (!casts.length) {
    out += "No posts found.\n";
  } else {
    casts.forEach((cast, i) => {
      out += `[${i + 1}] ${cast.timestamp}\n`;
      if (cast.parentHash) out += `\n[Reply]\n`;
      out += `${cast.text}\n`;

      // Only show reactions if includeReactions is true
      if (includeReactions) {
        out += `\nReactions:\n`;
        out += `- Likes: ${cast.reactions.likes}\n`;
        out += `- Recasts: ${cast.reactions.recasts}\n`;
      }

      const embeds = cast.embeds?.filter((e) => e?.url) || [];
      if (embeds.length) {
        out += `\nEmbeds:\n${embeds.map((e) => `- ${e.url}`).join("\n")}\n`;
      }
      out += `\n---\n\n`;
    });
  }

  return out;
}

// App
const app = new Hono();

app.use(
  "/*",
  cors({
    origin: ["https://llm-fid.fun", "http://localhost:3000"],
    allowMethods: ["GET"],
    maxAge: 86400,
  })
);

app.get("/", async (c) => {
  try {
    const q = c.req.query() as FarcasterQueryParams;

    if (!Object.keys(q).length) return c.redirect("https://llm-fid.fun");
    if (!q.fid && !q.username) return c.text("fid or username required", 400);

    // Parse params
    if (q.fid) {
      const n = Number(q.fid);
      if (isNaN(n) || n <= 0) return c.text("Invalid FID", 400);
      q.fid = n;
    }
    if (q.limit && (isNaN(Number(q.limit)) || Number(q.limit) <= 0)) {
      return c.text("Invalid limit", 400);
    }
    if (q.sortOrder && !["newest", "oldest"].includes(q.sortOrder)) {
      return c.text("Invalid sortOrder (must be 'newest' or 'oldest')", 400);
    }

    // Boolean params
    q.all = String(q.all).toLowerCase() === "true";
    q.includeReplies = String(q.includeReplies).toLowerCase() === "true";
    q.includeParents = String(q.includeParents).toLowerCase() === "true";
    q.includeReactions = String(q.includeReactions).toLowerCase() === "true";

    // Normalize username
    if (q.username) {
      q.username = q.username.toLowerCase().replace(/^@/, "");
    }

    const data = await fetchUserData(q.fid || q.username || "", q);

    c.header("Content-Type", "text/plain");
    return c.text(formatTextOutput(data));
  } catch (err) {
    console.error(err);
    return c.text(`Error: ${err instanceof Error ? err.message : "Unknown"}`, 500);
  }
});

export default app;
