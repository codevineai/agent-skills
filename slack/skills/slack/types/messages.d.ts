/**
 * Slack Messages API Types
 *
 * Types for message operations: sending, updating, deleting, reactions, and scheduling.
 *
 * All methods accept channel ID (C01234567) or channel name (general, #general).
 */

/**
 * Channel identifier - can be an ID (C01234567) or a name (general, #general).
 */
type ChannelId = string;

// ============================================================================
// MESSAGE OPTIONS
// ============================================================================

interface SendMessageOptions {
  /** Reply in thread (message timestamp to reply to) */
  threadTs?: string;
  /** Also post to channel when replying in thread */
  replyBroadcast?: boolean;
  /** Unfurl links in message */
  unfurlLinks?: boolean;
  /** Unfurl media in message */
  unfurlMedia?: boolean;
  /** Parse text as mrkdwn (default: true) */
  mrkdwn?: boolean;
  /** Block Kit blocks for rich formatting */
  blocks?: SlackBlock[];
  /** Legacy attachments */
  attachments?: SlackAttachment[];
}

interface SendBlocksOptions {
  /** Fallback text for notifications (required for accessibility) */
  fallbackText?: string;
  /** Reply in thread */
  threadTs?: string;
  /** Also post to channel when replying in thread */
  replyBroadcast?: boolean;
}

interface UpdateMessageOptions {
  /** Updated blocks */
  blocks?: SlackBlock[];
  /** Updated attachments */
  attachments?: SlackAttachment[];
}

interface ScheduleMessageOptions {
  /** Reply in thread */
  threadTs?: string;
  /** Block Kit blocks */
  blocks?: SlackBlock[];
}

interface ListScheduledOptions {
  /** Filter by channel */
  channel?: string;
  /** Pagination cursor */
  cursor?: string;
  /** Max results */
  limit?: number;
  /** Start of time range */
  oldest?: number;
  /** End of time range */
  latest?: number;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

interface SendMessageResponse {
  ok: boolean;
  channel: string;
  ts: string;
  message: SlackMessage;
}

interface UpdateMessageResponse {
  ok: boolean;
  channel: string;
  ts: string;
  text: string;
}

interface DeleteMessageResponse {
  ok: boolean;
  channel: string;
  ts: string;
}

interface ReactionResponse {
  ok: boolean;
}

interface ScheduleMessageResponse {
  ok: boolean;
  channel: string;
  scheduled_message_id: string;
  post_at: number;
}

interface ScheduledMessage {
  id: string;
  channel_id: string;
  post_at: number;
  date_created: number;
  text?: string;
}

interface ListScheduledResponse {
  ok: boolean;
  scheduled_messages: ScheduledMessage[];
  response_metadata?: {
    next_cursor: string;
  };
}

// ============================================================================
// MESSAGES API INTERFACE
// ============================================================================

interface MessagesAPI {
  /**
   * Send a message to a channel
   *
   * @example
   * // Simple message by channel name
   * const { ts } = await slack.messages.send('general', 'Hello, world!');
   * console.log(`Sent message: ${ts}`);
   *
   * @example
   * // Reply in thread
   * await slack.messages.send('#engineering', 'This is a reply', {
   *   threadTs: '1234567890.123456'
   * });
   *
   * @example
   * // Message with formatting
   * await slack.messages.send('random', '*Bold* and _italic_ with `code`');
   */
  send(channel: ChannelId, text: string, options?: SendMessageOptions): Promise<SendMessageResponse>;

  /**
   * Send a message with Block Kit blocks for rich formatting
   *
   * @example
   * await slack.messages.sendBlocks('announcements', [
   *   {
   *     type: 'section',
   *     text: { type: 'mrkdwn', text: '*Important Update*' }
   *   },
   *   {
   *     type: 'divider'
   *   },
   *   {
   *     type: 'section',
   *     text: { type: 'mrkdwn', text: 'Here are the details...' }
   *   }
   * ], { fallbackText: 'Important Update' });
   */
  sendBlocks(channel: ChannelId, blocks: SlackBlock[], options?: SendBlocksOptions): Promise<SendMessageResponse>;

  /**
   * Update an existing message
   *
   * @example
   * await slack.messages.update('general', '1234567890.123456', 'Updated text');
   */
  update(channel: ChannelId, ts: string, text: string, options?: UpdateMessageOptions): Promise<UpdateMessageResponse>;

  /**
   * Delete a message
   *
   * @example
   * await slack.messages.delete('general', '1234567890.123456');
   */
  delete(channel: ChannelId, ts: string): Promise<DeleteMessageResponse>;

  /**
   * Add an emoji reaction to a message
   *
   * @example
   * // Add thumbs up reaction
   * await slack.messages.react('general', '1234567890.123456', 'thumbsup');
   *
   * @example
   * // Works with or without colons
   * await slack.messages.react('#engineering', '1234567890.123456', ':white_check_mark:');
   */
  react(channel: ChannelId, ts: string, emoji: string): Promise<ReactionResponse>;

  /**
   * Remove an emoji reaction from a message
   *
   * @example
   * await slack.messages.unreact('general', '1234567890.123456', 'thumbsup');
   */
  unreact(channel: ChannelId, ts: string, emoji: string): Promise<ReactionResponse>;

  /**
   * Schedule a message for later
   *
   * @example
   * // Schedule for specific time
   * const futureTime = new Date('2024-12-25T09:00:00Z');
   * const { scheduled_message_id } = await slack.messages.schedule(
   *   'announcements',
   *   'Merry Christmas!',
   *   futureTime
   * );
   *
   * @example
   * // Schedule using Unix timestamp
   * const inOneHour = Math.floor(Date.now() / 1000) + 3600;
   * await slack.messages.schedule('#reminders', 'Reminder!', inOneHour);
   */
  schedule(channel: ChannelId, text: string, postAt: Date | number, options?: ScheduleMessageOptions): Promise<ScheduleMessageResponse>;

  /**
   * List scheduled messages
   *
   * @example
   * const { scheduled_messages } = await slack.messages.listScheduled();
   * for (const msg of scheduled_messages) {
   *   const date = new Date(msg.post_at * 1000);
   *   console.log(`${msg.id}: scheduled for ${date.toISOString()}`);
   * }
   */
  listScheduled(options?: ListScheduledOptions): Promise<ListScheduledResponse>;

  /**
   * Delete a scheduled message before it's sent
   *
   * @example
   * await slack.messages.deleteScheduled('announcements', 'Q1234ABCD5678');
   */
  deleteScheduled(channel: ChannelId, scheduledMessageId: string): Promise<{ ok: boolean }>;
}
