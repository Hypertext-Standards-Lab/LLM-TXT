/**
 * Git repository metadata
 */
export interface GitRepo {
  name: string;
  fullName: string;
  description?: string;
  url: string;
  defaultBranch: string;
  language?: string;
  stars?: number;
  forks?: number;
  size: number; // in KB
  createdAt?: string;
  updatedAt?: string;
  owner: {
    name: string;
    url: string;
    avatar?: string;
  };
  topics?: string[];
  license?: string;
}

/**
 * Git file entry
 */
export interface GitFile {
  path: string;
  name: string;
  type: "file" | "dir";
  size?: number;
  content?: string;
  sha?: string;
}

/**
 * Response metadata for LLM usage
 */
export interface GitResponseMeta {
  commitSha: string;
  branch: string;
  outputBytes: number;
  estimatedTokens: number;
  filteredFileCount: number;
  totalFileCount: number;
}

/**
 * Response structure for Git API
 */
export interface GitResponse {
  repo: GitRepo;
  files: GitFile[];
  readme?: string;
  tree?: GitFile[];
  meta?: GitResponseMeta;
}

/**
 * Query parameters for Git API
 */
export interface GitQueryParams {
  url: string;
  branch?: string;
  includeContent?: boolean;
  maxFileSize?: number; // Max file size in bytes to include content
  includeTree?: boolean;
  includePatterns?: string[]; // Glob patterns to include (e.g., ["src/**/*.ts", "*.md"])
  excludePatterns?: string[]; // Glob patterns to exclude (e.g., ["node_modules/**", "*.lock"])
}
