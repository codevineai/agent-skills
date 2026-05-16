/**
 * Slack Channels API Types
 *
 * Types for channel operations: listing, info, history, and membership.
 */

// ============================================================================
// CHANNEL IDENTIFIER
// ============================================================================

/**
 * Channel identifier - can be an ID (C01234567) or a name (general, #general).
 * The API automatically resolves names to IDs.
 */
type ChannelId = string;

// ============================================================================
// CHANNEL TYPES
// ============================================================================

interface SlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_group: boolean;
  is_im: boolean;
  is_mpim: boolean;
  is_private: boolean;
  is_archived: boolean;
  is_general: boolean;
  is_shared: boolean;
  is_org_shared: boolean;
  is_member: boolean;
  created: number;
  creator: string;
  name_normalized: string;
  num_members?: number;
  topic?: {
    value: string;
    creator: string;
    last_set: number;
  };
  purpose?: {
    value: string;
    creator: string;
    last_set: number;
  };
}

interface SlackMessage {
  type: string;
  subtype?: string;
  ts: string;
  user?: string;
  text: string;
  thread_ts?: string;
  reply_count?: number;
  reply_users_count?: number;
  latest_reply?: string;
  reply_users?: string[];
  reactions?: {
    name: string;
    count: number;
    users: string[];
  }[];
  attachments?: SlackAttachment[];
  blocks?: SlackBlock[];
  files?: SlackFile[];
  edited?: {
    user: string;
    ts: string;
  };
  bot_id?: string;
  app_id?: string;
}

interface SlackAttachment {
  fallback?: string;
  color?: string;
  pretext?: string;
  author_name?: string;
  author_link?: string;
  author_icon?: string;
  title?: string;
  title_link?: string;
  text?: string;
  fields?: {
    title: string;
    value: string;
    short: boolean;
  }[];
  image_url?: string;
  thumb_url?: string;
  footer?: string;
  footer_icon?: string;
  ts?: number;
}

interface SlackBlock {
  type: string;
  block_id?: string;
  [key: string]: any;
}

interface SlackFile {
  id: string;
  name: string;
  title: string;
  mimetype: string;
  filetype: string;
  size: number;
  url_private?: string;
  url_private_download?: string;
  permalink: string;
  created: number;
  user: string;
}

// ============================================================================
// REQUEST OPTIONS
// ============================================================================

interface ChannelListOptions {
  /** Channel types to include (default: "public_channel,private_channel") */
  types?: string;
  /** Exclude archived channels (default: true) */
  excludeArchived?: boolean;
  /** Number of results per page (default: 100, max: 1000) */
  limit?: number;
  /** Pagination cursor for next page */
  cursor?: string;
}

interface ChannelHistoryOptions {
  /** Number of messages to return (default: 100, max: 1000) */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
  /** Start of time range (Unix timestamp) */
  oldest?: string;
  /** End of time range (Unix timestamp) */
  latest?: string;
  /** Include messages with oldest/latest timestamps */
  inclusive?: boolean;
}

interface ChannelRepliesOptions {
  /** Number of replies to return (default: 100) */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
  /** Start of time range */
  oldest?: string;
  /** End of time range */
  latest?: string;
  /** Include boundary messages */
  inclusive?: boolean;
}

interface ChannelMembersOptions {
  /** Number of members per page (default: 100) */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

interface ChannelListResponse {
  ok: boolean;
  channels: SlackChannel[];
  response_metadata?: {
    next_cursor: string;
  };
}

interface ChannelInfoResponse {
  ok: boolean;
  channel: SlackChannel;
}

interface ChannelHistoryResponse {
  ok: boolean;
  messages: SlackMessage[];
  has_more: boolean;
  response_metadata?: {
    next_cursor: string;
  };
}

interface ChannelRepliesResponse {
  ok: boolean;
  messages: SlackMessage[];
  has_more: boolean;
  response_metadata?: {
    next_cursor: string;
  };
}

interface ChannelJoinResponse {
  ok: boolean;
  channel: SlackChannel;
}

interface ChannelMembersResponse {
  ok: boolean;
  members: string[];
  response_metadata?: {
    next_cursor: string;
  };
}

// ============================================================================
// CHANNELS API INTERFACE
// ============================================================================

interface ChannelsAPI {
  /**
   * Resolve a channel name or ID to a channel ID.
   * All other channel methods call this internally, so you rarely need it directly.
   * Pass channel names directly to methods like send() - don't manually resolve first.
   *
   * @example
   * const channelId = await slack.channels.resolve('general');
   * console.log(channelId); // 'C01234567'
   *
   * @example
   * // Already an ID? Returns it unchanged
   * const channelId = await slack.channels.resolve('C01234567');
   * console.log(channelId); // 'C01234567'
   */
  resolve(channelOrName: ChannelId): Promise<string>;

  /**
   * Find a channel by name. Returns full channel info.
   * Works for public, private, and channels you're a member of.
   *
   * @example
   * const channel = await slack.channels.find('general');
   * console.log(`#${channel.name} (${channel.id})`);
   *
   * @example
   * // Works with # prefix too
   * const channel = await slack.channels.find('#engineering');
   */
  find(name: ChannelId): Promise<SlackChannel>;

  /**
   * List all channels the bot has access to
   *
   * @example
   * // List all public channels
   * const result = await slack.channels.list();
   * for (const ch of result.channels) {
   *   console.log(`#${ch.name} (${ch.id}) - ${ch.num_members} members`);
   * }
   *
   * @example
   * // Paginate through all channels
   * let cursor;
   * do {
   *   const result = await slack.channels.list({ cursor, limit: 100 });
   *   for (const ch of result.channels) console.log(ch.name);
   *   cursor = result.response_metadata?.next_cursor;
   * } while (cursor);
   */
  list(options?: ChannelListOptions): Promise<ChannelListResponse>;

  /**
   * Get detailed info about a channel by ID or name
   *
   * @example
   * const { channel } = await slack.channels.info('general');
   * console.log(`Topic: ${channel.topic?.value}`);
   *
   * @example
   * // Also works with ID
   * const { channel } = await slack.channels.info('C01234567');
   */
  info(channel: ChannelId): Promise<ChannelInfoResponse>;

  /**
   * Get message history from a channel
   *
   * @example
   * // Get last 50 messages by channel name
   * const { messages } = await slack.channels.history('engineering', { limit: 50 });
   * for (const msg of messages) {
   *   console.log(`${msg.user}: ${msg.text}`);
   * }
   *
   * @example
   * // Get messages from last 24 hours
   * const yesterday = Math.floor(Date.now() / 1000) - 86400;
   * const { messages } = await slack.channels.history('#general', {
   *   oldest: String(yesterday)
   * });
   */
  history(channel: ChannelId, options?: ChannelHistoryOptions): Promise<ChannelHistoryResponse>;

  /**
   * Get replies in a thread
   *
   * @example
   * // Get all replies to a message
   * const { messages } = await slack.channels.replies('general', '1234567890.123456');
   * console.log(`Thread has ${messages.length} messages`);
   * for (const msg of messages) {
   *   console.log(`  ${msg.user}: ${msg.text}`);
   * }
   */
  replies(channel: ChannelId, ts: string, options?: ChannelRepliesOptions): Promise<ChannelRepliesResponse>;

  /**
   * Join a public channel
   *
   * @example
   * await slack.channels.join('new-project');
   * console.log('Joined channel');
   */
  join(channel: ChannelId): Promise<ChannelJoinResponse>;

  /**
   * Get list of member IDs in a channel
   *
   * @example
   * const { members } = await slack.channels.members('engineering');
   * console.log(`Channel has ${members.length} members`);
   * // members is array of user IDs like ['U01234567', 'U89012345']
   */
  members(channel: ChannelId, options?: ChannelMembersOptions): Promise<ChannelMembersResponse>;
}
