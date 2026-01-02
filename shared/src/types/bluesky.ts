/**
 * Bluesky User Profile
 */
export interface BlueskyUser {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
}

/**
 * Bluesky Post (equivalent to FarcasterCast)
 */
export interface BlueskyPost {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
  };
  text: string;
  createdAt: string;
  replyParent?: string;
  replyRoot?: string;
  parentPost?: BlueskyPost;
  embeds?: Array<{
    type: "image" | "external" | "record" | "video";
    url?: string;
    title?: string;
    description?: string;
  }>;
  likeCount: number;
  repostCount: number;
  replyCount: number;
  quoteCount: number;
}

/**
 * Response structure for Bluesky API
 */
export interface BlueskyResponse {
  user: BlueskyUser;
  posts: BlueskyPost[];
}

/**
 * Query parameters for Bluesky API - mirrors FarcasterQueryParams
 */
export interface BlueskyQueryParams {
  handle?: string;
  did?: string;
  limit?: number;
  sortOrder?: "newest" | "oldest";
  includeReplies?: boolean;
  all?: boolean;
  includeReactions?: boolean;
  includeParents?: boolean;
}
