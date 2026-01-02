export interface FarcasterUser {
  fid: number;
  username: string;
  displayName?: string;
  bio?: string;
  pfp?: string;
  url?: string;
  location?: string;
  twitter?: string;
  github?: string;
}

export interface FarcasterCast {
  hash: string;
  threadHash: string;
  parentHash?: string;
  parentCast?: FarcasterCast;
  author: {
    fid: number;
    username: string;
  };
  text: string;
  timestamp: string;
  attachments?: Array<{
    type: string;
    url: string;
  }>;
  embeds?: Array<{
    type: string;
    url: string;
  }>;
  reactions: {
    likes: number;
    recasts: number;
  };
}

export interface FarcasterResponse {
  user: FarcasterUser;
  casts: FarcasterCast[];
}

export interface FarcasterQueryParams {
  fid?: number;
  username?: string;
  limit?: number;
  sortOrder?: "newest" | "oldest";
  includeReplies?: boolean;
  all?: boolean;
  includeReactions?: boolean;
  includeParents?: boolean;
}
