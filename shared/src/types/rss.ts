/**
 * RSS Feed metadata
 */
export interface RssFeed {
  title: string;
  description?: string;
  link: string;
  language?: string;
  lastBuildDate?: string;
  generator?: string;
  itemCount: number;
}

/**
 * RSS Feed item
 */
export interface RssItem {
  title: string;
  link: string;
  description?: string;
  content?: string;
  pubDate?: string;
  author?: string;
  categories?: string[];
  guid?: string;
  enclosure?: {
    url: string;
    type?: string;
    length?: number;
  };
}

/**
 * Response structure for RSS API
 */
export interface RssResponse {
  feed: RssFeed;
  items: RssItem[];
}

/**
 * Query parameters for RSS API
 */
export interface RssQueryParams {
  url: string;
  limit?: number;
  all?: boolean;
  includeContent?: boolean;
  sortOrder?: "newest" | "oldest";
}
