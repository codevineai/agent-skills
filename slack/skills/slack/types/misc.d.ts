/**
 * Slack Miscellaneous API Types
 *
 * Types for bookmarks, pins, and reminders.
 * All methods accept channel ID (C01234567) or channel name (general, #general).
 */

/**
 * Channel identifier - can be an ID (C01234567) or a name (general, #general).
 */
type ChannelId = string;

// ============================================================================
// BOOKMARK TYPES
// ============================================================================

interface SlackBookmark {
  id: string;
  channel_id: string;
  title: string;
  link?: string;
  emoji?: string;
  icon_url?: string;
  type: 'link' | 'folder';
  date_created: number;
  date_updated: number;
  rank: string;
  last_updated_by_user_id: string;
  last_updated_by_team_id: string;
}

// ============================================================================
// PIN TYPES
// ============================================================================

interface SlackPinnedItem {
  type: 'message' | 'file';
  channel: string;
  message?: SlackMessage;
  file?: SlackFile;
  created: number;
  created_by: string;
}

// ============================================================================
// REMINDER TYPES
// ============================================================================

interface SlackReminder {
  id: string;
  creator: string;
  user: string;
  text: string;
  recurring: boolean;
  time: number;
  complete_ts?: number;
}

// ============================================================================
// REQUEST OPTIONS
// ============================================================================

interface BookmarkAddOptions {
  /** URL for link bookmarks */
  link?: string;
  /** Emoji to display */
  emoji?: string;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

interface BookmarkListResponse {
  ok: boolean;
  bookmarks: SlackBookmark[];
}

interface BookmarkAddResponse {
  ok: boolean;
  bookmark: SlackBookmark;
}

interface BookmarkRemoveResponse {
  ok: boolean;
}

interface PinListResponse {
  ok: boolean;
  items: SlackPinnedItem[];
}

interface PinResponse {
  ok: boolean;
}

interface ReminderAddResponse {
  ok: boolean;
  reminder: SlackReminder;
}

interface ReminderListResponse {
  ok: boolean;
  reminders: SlackReminder[];
}

interface ReminderResponse {
  ok: boolean;
}

// ============================================================================
// BOOKMARKS API INTERFACE
// ============================================================================

interface BookmarksAPI {
  /**
   * List bookmarks in a channel
   *
   * @example
   * const { bookmarks } = await slack.bookmarks.list('engineering');
   * for (const b of bookmarks) {
   *   console.log(`${b.emoji || ''} ${b.title}: ${b.link}`);
   * }
   */
  list(channel: ChannelId): Promise<BookmarkListResponse>;

  /**
   * Add a bookmark to a channel
   *
   * @example
   * await slack.bookmarks.add('engineering', 'Documentation', 'link', {
   *   link: 'https://docs.example.com',
   *   emoji: ':book:'
   * });
   */
  add(channel: ChannelId, title: string, type: 'link' | 'folder', options?: BookmarkAddOptions): Promise<BookmarkAddResponse>;

  /**
   * Remove a bookmark
   *
   * @example
   * await slack.bookmarks.remove('engineering', 'Bk01234567');
   */
  remove(channel: ChannelId, bookmarkId: string): Promise<BookmarkRemoveResponse>;
}

// ============================================================================
// PINS API INTERFACE
// ============================================================================

interface PinsAPI {
  /**
   * List pinned items in a channel
   *
   * @example
   * const { items } = await slack.pins.list('general');
   * for (const item of items) {
   *   if (item.type === 'message') {
   *     console.log(`Pinned message: ${item.message?.text}`);
   *   } else if (item.type === 'file') {
   *     console.log(`Pinned file: ${item.file?.name}`);
   *   }
   * }
   */
  list(channel: ChannelId): Promise<PinListResponse>;

  /**
   * Pin a message to a channel
   *
   * @example
   * await slack.pins.add('general', '1234567890.123456');
   * console.log('Message pinned');
   */
  add(channel: ChannelId, ts: string): Promise<PinResponse>;

  /**
   * Unpin a message
   *
   * @example
   * await slack.pins.remove('general', '1234567890.123456');
   */
  remove(channel: ChannelId, ts: string): Promise<PinResponse>;
}

// ============================================================================
// REMINDERS API INTERFACE
// ============================================================================

interface RemindersAPI {
  /**
   * Create a reminder
   *
   * @example
   * // Remind in 1 hour
   * const inOneHour = Math.floor(Date.now() / 1000) + 3600;
   * await slack.reminders.add('Review PR #123', inOneHour);
   *
   * @example
   * // Remind at specific time
   * const tomorrow9am = new Date('2024-12-26T09:00:00');
   * await slack.reminders.add('Team standup', tomorrow9am);
   *
   * @example
   * // Natural language time (Slack parses it)
   * await slack.reminders.add('Check deployment', 'tomorrow at 3pm');
   *
   * @example
   * // Remind another user
   * await slack.reminders.add('Submit timesheet', 'Friday at 5pm', { user: 'U01234567' });
   */
  add(text: string, time: Date | number | string, options?: { user?: string }): Promise<ReminderAddResponse>;

  /**
   * List all reminders for the authenticated user
   *
   * @example
   * const { reminders } = await slack.reminders.list();
   * for (const r of reminders) {
   *   const date = new Date(r.time * 1000);
   *   console.log(`${r.text} - ${date.toLocaleString()}`);
   * }
   */
  list(): Promise<ReminderListResponse>;

  /**
   * Delete a reminder
   *
   * @example
   * await slack.reminders.delete('Rm01234567');
   */
  delete(reminder: string): Promise<ReminderResponse>;

  /**
   * Mark a reminder as complete
   *
   * @example
   * await slack.reminders.complete('Rm01234567');
   */
  complete(reminder: string): Promise<ReminderResponse>;
}
