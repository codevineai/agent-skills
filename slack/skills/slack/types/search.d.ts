/**
 * Slack Search API Types
 *
 * Types for search operations. Requires the search:read scope.
 */

// ============================================================================
// SEARCH RESULT TYPES
// ============================================================================

interface SlackSearchMatch {
  iid: string;
  team: string;
  channel: {
    id: string;
    is_channel: boolean;
    is_group: boolean;
    is_im: boolean;
    name: string;
    is_shared: boolean;
    is_org_shared: boolean;
    is_ext_shared: boolean;
    is_private: boolean;
    is_mpim: boolean;
  };
  type: string;
  user: string;
  username: string;
  ts: string;
  text: string;
  permalink: string;
  no_reactions?: boolean;
  previous?: {
    user: string;
    username: string;
    text: string;
    ts: string;
    type: string;
  };
  previous_2?: {
    user: string;
    username: string;
    text: string;
    ts: string;
    type: string;
  };
  next?: {
    user: string;
    username: string;
    text: string;
    ts: string;
    type: string;
  };
  next_2?: {
    user: string;
    username: string;
    text: string;
    ts: string;
    type: string;
  };
}

interface SlackFileMatch {
  id: string;
  created: number;
  timestamp: number;
  name: string;
  title: string;
  mimetype: string;
  filetype: string;
  pretty_type: string;
  user: string;
  username: string;
  size: number;
  mode: string;
  is_external: boolean;
  external_type: string;
  is_public: boolean;
  public_url_shared: boolean;
  url_private: string;
  url_private_download: string;
  permalink: string;
  permalink_public?: string;
  channels: string[];
  groups: string[];
  ims: string[];
}

// ============================================================================
// REQUEST OPTIONS
// ============================================================================

interface SearchOptions {
  /** Number of results per page (default: 20, max: 100) */
  count?: number;
  /** Page number (1-indexed, default: 1) */
  page?: number;
  /** Sort field: 'score' or 'timestamp' (default: 'timestamp') */
  sort?: 'score' | 'timestamp';
  /** Sort direction: 'asc' or 'desc' (default: 'desc') */
  sortDir?: 'asc' | 'desc';
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

interface SearchMessagesResponse {
  ok: boolean;
  query: string;
  messages: {
    total: number;
    pagination: {
      total_count: number;
      page: number;
      per_page: number;
      page_count: number;
      first: number;
      last: number;
    };
    paging: {
      count: number;
      total: number;
      page: number;
      pages: number;
    };
    matches: SlackSearchMatch[];
  };
}

interface SearchAllResponse {
  ok: boolean;
  query: string;
  messages: {
    total: number;
    pagination: {
      total_count: number;
      page: number;
      per_page: number;
      page_count: number;
      first: number;
      last: number;
    };
    matches: SlackSearchMatch[];
  };
  files: {
    total: number;
    pagination: {
      total_count: number;
      page: number;
      per_page: number;
      page_count: number;
      first: number;
      last: number;
    };
    matches: SlackFileMatch[];
  };
}

// ============================================================================
// SEARCH API INTERFACE
// ============================================================================

interface SearchAPI {
  /**
   * Search for messages across the workspace
   *
   * Requires the search:read scope (user token, not bot token).
   *
   * @example
   * // Simple search
   * const { messages } = await slack.search.messages('deployment error');
   * console.log(`Found ${messages.total} messages`);
   * for (const match of messages.matches) {
   *   console.log(`${match.username} in #${match.channel.name}: ${match.text}`);
   *   console.log(`  ${match.permalink}`);
   * }
   *
   * @example
   * // Search with filters
   * const { messages } = await slack.search.messages('from:@john in:#engineering after:2024-01-01');
   *
   * @example
   * // Paginate through results
   * let page = 1;
   * let hasMore = true;
   * while (hasMore) {
   *   const { messages } = await slack.search.messages('bug', { page, count: 100 });
   *   for (const match of messages.matches) {
   *     console.log(match.text);
   *   }
   *   hasMore = page < messages.paging.pages;
   *   page++;
   * }
   *
   * Search modifiers:
   * - from:@username - Messages from a specific user
   * - in:#channel - Messages in a specific channel
   * - in:@username - Messages in DM with user
   * - before:YYYY-MM-DD - Messages before date
   * - after:YYYY-MM-DD - Messages after date
   * - on:YYYY-MM-DD - Messages on specific date
   * - has:link - Messages containing links
   * - has:reaction - Messages with reactions
   * - has::emoji: - Messages with specific reaction
   */
  messages(query: string, options?: SearchOptions): Promise<SearchMessagesResponse>;

  /**
   * Search for messages and files
   *
   * @example
   * const result = await slack.search.all('quarterly report');
   * console.log(`Found ${result.messages.total} messages and ${result.files.total} files`);
   */
  all(query: string, options?: SearchOptions): Promise<SearchAllResponse>;
}
