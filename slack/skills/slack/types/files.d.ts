/**
 * Slack Files API Types
 *
 * Types for file operations: listing, info, and deletion.
 * Channel filters accept ID (C01234567) or name (general, #general).
 */

/**
 * Channel identifier - can be an ID (C01234567) or a name (general, #general).
 */
type ChannelId = string;

// ============================================================================
// FILE TYPES
// ============================================================================

interface SlackFileDetail {
  id: string;
  created: number;
  timestamp: number;
  name: string;
  title: string;
  mimetype: string;
  filetype: string;
  pretty_type: string;
  user: string;
  user_team: string;
  editable: boolean;
  size: number;
  mode: string;
  is_external: boolean;
  external_type: string;
  is_public: boolean;
  public_url_shared: boolean;
  display_as_bot: boolean;
  username: string;
  url_private: string;
  url_private_download: string;
  permalink: string;
  permalink_public?: string;
  channels: string[];
  groups: string[];
  ims: string[];
  comments_count: number;
  shares?: {
    public?: Record<string, ShareInfo[]>;
    private?: Record<string, ShareInfo[]>;
  };
  has_rich_preview?: boolean;
  preview?: string;
  preview_highlight?: string;
  lines?: number;
  lines_more?: number;
  preview_is_truncated?: boolean;
  image_exif_rotation?: number;
  original_w?: number;
  original_h?: number;
  thumb_64?: string;
  thumb_80?: string;
  thumb_160?: string;
  thumb_360?: string;
  thumb_360_w?: number;
  thumb_360_h?: number;
  thumb_480?: string;
  thumb_480_w?: number;
  thumb_480_h?: number;
  thumb_720?: string;
  thumb_720_w?: number;
  thumb_720_h?: number;
  thumb_800?: string;
  thumb_800_w?: number;
  thumb_800_h?: number;
  thumb_960?: string;
  thumb_960_w?: number;
  thumb_960_h?: number;
  thumb_1024?: string;
  thumb_1024_w?: number;
  thumb_1024_h?: number;
}

interface ShareInfo {
  reply_users: string[];
  reply_users_count: number;
  reply_count: number;
  ts: string;
  channel_name: string;
  team_id: string;
}

// ============================================================================
// REQUEST OPTIONS
// ============================================================================

interface FileListOptions {
  /** Filter by channel (ID or name) */
  channel?: ChannelId;
  /** Filter by user who uploaded */
  user?: string;
  /** Filter by file types (comma-separated: spaces, snippets, images, gdocs, zips, pdfs) */
  types?: string;
  /** Number of files per page (default: 100) */
  count?: number;
  /** Page number (1-indexed) */
  page?: number;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

interface FileListResponse {
  ok: boolean;
  files: SlackFileDetail[];
  paging: {
    count: number;
    total: number;
    page: number;
    pages: number;
  };
}

interface FileInfoResponse {
  ok: boolean;
  file: SlackFileDetail;
  comments?: any[];
}

interface FileDeleteResponse {
  ok: boolean;
}

// ============================================================================
// FILES API INTERFACE
// ============================================================================

interface FilesAPI {
  /**
   * List files in the workspace
   *
   * @example
   * // List recent files
   * const { files } = await slack.files.list();
   * for (const file of files) {
   *   console.log(`${file.name} (${file.pretty_type}) - ${file.permalink}`);
   * }
   *
   * @example
   * // List files in a specific channel by name
   * const { files } = await slack.files.list({ channel: 'engineering' });
   *
   * @example
   * // List only images
   * const { files } = await slack.files.list({ types: 'images' });
   *
   * @example
   * // List files from a specific user
   * const { files } = await slack.files.list({ user: 'U01234567' });
   */
  list(options?: FileListOptions): Promise<FileListResponse>;

  /**
   * Get detailed info about a file
   *
   * @example
   * const { file } = await slack.files.info('F01234567');
   * console.log(`Name: ${file.name}`);
   * console.log(`Type: ${file.pretty_type}`);
   * console.log(`Size: ${file.size} bytes`);
   * console.log(`Shared in: ${file.channels.length} channels`);
   * console.log(`Download: ${file.url_private_download}`);
   */
  info(file: string): Promise<FileInfoResponse>;

  /**
   * Delete a file
   *
   * @example
   * await slack.files.delete('F01234567');
   * console.log('File deleted');
   */
  delete(file: string): Promise<FileDeleteResponse>;
}
