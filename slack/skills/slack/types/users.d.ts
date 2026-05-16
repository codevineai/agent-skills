/**
 * Slack Users API Types
 *
 * Types for user operations: listing, lookup, and presence.
 */

// ============================================================================
// USER TYPES
// ============================================================================

interface SlackUser {
  id: string;
  team_id: string;
  name: string;
  deleted: boolean;
  color?: string;
  real_name?: string;
  tz?: string;
  tz_label?: string;
  tz_offset?: number;
  profile: SlackUserProfile;
  is_admin: boolean;
  is_owner: boolean;
  is_primary_owner: boolean;
  is_restricted: boolean;
  is_ultra_restricted: boolean;
  is_bot: boolean;
  is_app_user: boolean;
  updated: number;
}

interface SlackUserProfile {
  title?: string;
  phone?: string;
  skype?: string;
  real_name?: string;
  real_name_normalized?: string;
  display_name?: string;
  display_name_normalized?: string;
  status_text?: string;
  status_emoji?: string;
  status_expiration?: number;
  avatar_hash?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  image_24?: string;
  image_32?: string;
  image_48?: string;
  image_72?: string;
  image_192?: string;
  image_512?: string;
  image_original?: string;
  team?: string;
}

interface SlackBotInfo {
  ok: boolean;
  url: string;
  team: string;
  user: string;
  team_id: string;
  user_id: string;
  bot_id?: string;
  is_enterprise_install: boolean;
}

// ============================================================================
// REQUEST OPTIONS
// ============================================================================

interface UserListOptions {
  /** Number of users per page (default: 100) */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
  /** Include locale info */
  includeLocale?: boolean;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

interface UserListResponse {
  ok: boolean;
  members: SlackUser[];
  cache_ts: number;
  response_metadata?: {
    next_cursor: string;
  };
}

interface UserInfoResponse {
  ok: boolean;
  user: SlackUser;
}

interface UserLookupResponse {
  ok: boolean;
  user: SlackUser;
}

interface UserPresenceResponse {
  ok: boolean;
  presence: 'active' | 'away';
  online?: boolean;
  auto_away?: boolean;
  manual_away?: boolean;
  connection_count?: number;
  last_activity?: number;
}

// ============================================================================
// USERS API INTERFACE
// ============================================================================

interface UsersAPI {
  /**
   * List all users in the workspace
   *
   * @example
   * // Get all users
   * const { members } = await slack.users.list();
   * for (const user of members) {
   *   if (!user.deleted && !user.is_bot) {
   *     console.log(`${user.real_name} (@${user.name}) - ${user.profile.email}`);
   *   }
   * }
   *
   * @example
   * // Paginate through large workspace
   * let cursor;
   * const allUsers = [];
   * do {
   *   const result = await slack.users.list({ cursor, limit: 200 });
   *   allUsers.push(...result.members);
   *   cursor = result.response_metadata?.next_cursor;
   * } while (cursor);
   * console.log(`Total users: ${allUsers.length}`);
   */
  list(options?: UserListOptions): Promise<UserListResponse>;

  /**
   * Get info about a specific user by ID
   *
   * @example
   * const { user } = await slack.users.info('U01234567');
   * console.log(`Name: ${user.real_name}`);
   * console.log(`Email: ${user.profile.email}`);
   * console.log(`Title: ${user.profile.title}`);
   * console.log(`Timezone: ${user.tz_label}`);
   */
  info(user: string): Promise<UserInfoResponse>;

  /**
   * Look up a user by their email address
   *
   * @example
   * const { user } = await slack.users.lookupByEmail('john@example.com');
   * console.log(`Found: ${user.real_name} (${user.id})`);
   *
   * @example
   * // Send DM to user by email
   * const { user } = await slack.users.lookupByEmail('john@example.com');
   * await slack.dm.send(user.id, 'Hello from the bot!');
   */
  lookupByEmail(email: string): Promise<UserLookupResponse>;

  /**
   * Get info about the authenticated bot user
   *
   * @example
   * const info = await slack.users.identity();
   * console.log(`Bot: ${info.user} (${info.user_id})`);
   * console.log(`Team: ${info.team} (${info.team_id})`);
   */
  identity(): Promise<SlackBotInfo>;

  /**
   * Get a user's presence status
   *
   * @example
   * const { presence, online } = await slack.users.presence('U01234567');
   * console.log(`User is ${presence}`); // 'active' or 'away'
   */
  presence(user: string): Promise<UserPresenceResponse>;
}
