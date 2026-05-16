/**
 * Slack Direct Messages API Types
 *
 * Types for direct message operations.
 */

// ============================================================================
// DM TYPES
// ============================================================================

interface SlackDMChannel {
  id: string;
  created: number;
  is_archived: boolean;
  is_im: boolean;
  is_org_shared: boolean;
  user: string;
  is_user_deleted: boolean;
  priority: number;
}

interface SlackMPIMChannel {
  id: string;
  name: string;
  is_mpim: boolean;
  is_group: boolean;
  created: number;
  creator: string;
  members: string[];
  is_open: boolean;
  topic: {
    value: string;
    creator: string;
    last_set: number;
  };
  purpose: {
    value: string;
    creator: string;
    last_set: number;
  };
}

// ============================================================================
// REQUEST OPTIONS
// ============================================================================

interface DMSendOptions {
  /** Reply in thread */
  threadTs?: string;
  /** Block Kit blocks */
  blocks?: SlackBlock[];
  /** Legacy attachments */
  attachments?: SlackAttachment[];
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

interface DMOpenResponse {
  ok: boolean;
  channel: SlackDMChannel | SlackMPIMChannel;
  no_op?: boolean;
  already_open?: boolean;
}

// ============================================================================
// DM API INTERFACE
// ============================================================================

interface DMAPI {
  /**
   * Open a DM conversation with one or more users
   *
   * @example
   * // Open DM with single user
   * const { channel } = await slack.dm.open('U01234567');
   * console.log(`DM channel: ${channel.id}`);
   *
   * @example
   * // Open group DM (MPIM) with multiple users
   * const { channel } = await slack.dm.open(['U01234567', 'U89012345']);
   * console.log(`Group DM: ${channel.id}`);
   */
  open(users: string | string[]): Promise<DMOpenResponse>;

  /**
   * Send a DM to a user (automatically opens DM channel if needed)
   *
   * @example
   * // Simple DM
   * await slack.dm.send('U01234567', 'Hello! This is a direct message.');
   *
   * @example
   * // DM with blocks
   * await slack.dm.send('U01234567', 'Notification', {
   *   blocks: [
   *     {
   *       type: 'section',
   *       text: { type: 'mrkdwn', text: '*Your build completed*' }
   *     },
   *     {
   *       type: 'section',
   *       fields: [
   *         { type: 'mrkdwn', text: '*Status:* Success' },
   *         { type: 'mrkdwn', text: '*Duration:* 2m 34s' }
   *       ]
   *     }
   *   ]
   * });
   *
   * @example
   * // Find user by email and DM them
   * const { user } = await slack.users.lookupByEmail('john@example.com');
   * await slack.dm.send(user.id, 'Important notification!');
   */
  send(userId: string, text: string, options?: DMSendOptions): Promise<SendMessageResponse>;
}
