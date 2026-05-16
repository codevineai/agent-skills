#!/usr/bin/env node
/**
 * Slack API Skill
 *
 * Send messages, read channels, and manage conversations in Slack.
 *
 * Credentials (in priority order):
 *   1. Environment variables: SLACK_BOT_TOKEN
 *   2. Credentials file: ~/.slack/credentials (INI format with profiles)
 */

import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PLATFORM = 'slack';
const CREDENTIAL_KEYS = ['SLACK_TOKEN'];

// ============================================================================
// CREDENTIALS HELPER
// ============================================================================

function parseIniFile(content) {
  const profiles = {};
  let currentProfile = 'default';

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) continue;

    const profileMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (profileMatch) {
      currentProfile = profileMatch[1].trim();
      if (!profiles[currentProfile]) profiles[currentProfile] = {};
      continue;
    }

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      // Remove surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!profiles[currentProfile]) profiles[currentProfile] = {};
      profiles[currentProfile][key] = value;
    }
  }
  return profiles;
}

function loadCredentialsFile(platform) {
  const paths = [
    join(process.cwd(), `.${platform}`, 'credentials'),
    join(homedir(), `.${platform}`, 'credentials')
  ];

  for (const path of paths) {
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, 'utf-8');
        return { profiles: parseIniFile(content), path };
      } catch (e) { /* Continue */ }
    }
  }
  return { profiles: {}, path: null };
}

function getCredentials(platform, keys) {
  const values = {};
  const missing = [];

  const profile = process.env.LAUNCHCODE_PROFILE || 'default';
  const { profiles, path: credsPath } = loadCredentialsFile(platform);
  const profileData = profiles[profile] || {};

  for (const key of keys) {
    // Check env var (with trimming)
    if (process.env[key]) {
      values[key] = process.env[key].trim();
      continue;
    }
    // Check profile data (already trimmed during parsing)
    if (profileData[key]) {
      values[key] = profileData[key];
      continue;
    }
    // Fall back to default profile
    if (profile !== 'default' && profiles['default']?.[key]) {
      values[key] = profiles['default'][key];
      continue;
    }
    missing.push(key);
  }

  if (missing.length > 0) {
    let error = `\nSlack credentials not found.\n\n`;
    error += `Create ~/.slack/credentials with:\n\n`;
    error += `   SLACK_TOKEN=xoxp-your-token-here\n\n`;
    error += `Get your token:\n`;
    error += `   1. Go to https://api.slack.com/apps\n`;
    error += `   2. Create or select an app\n`;
    error += `   3. Go to "OAuth & Permissions"\n`;
    error += `   4. Add scopes under "User Token Scopes" (for acting as yourself)\n`;
    error += `      or "Bot Token Scopes" (for a bot identity)\n`;
    error += `   5. Install/reinstall the app to your workspace\n`;
    error += `   6. Copy the token (xoxp-... for user, xoxb-... for bot)\n\n`;
    error += `Recommended scopes:\n`;
    error += `   channels:read, channels:history, chat:write, users:read,\n`;
    error += `   groups:read, groups:history, im:read, im:write, search:read\n`;
    throw new Error(error);
  }

  return values;
}

// ============================================================================
// LOAD CREDENTIALS
// ============================================================================

let token;
try {
  const creds = getCredentials(PLATFORM, CREDENTIAL_KEYS);
  token = creds.SLACK_TOKEN;
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

// ============================================================================
// HTTP CLIENT
// ============================================================================

async function request(method, endpoint, body = null, queryParams = null) {
  let url = `https://slack.com/api/${endpoint}`;

  if (queryParams) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8'
    }
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Slack API error (${endpoint}): ${data.error}${data.response_metadata?.messages ? '\n' + data.response_metadata.messages.join('\n') : ''}`);
  }

  return data;
}

// ============================================================================
// CHANNEL RESOLVER - converts channel names to IDs
// ============================================================================

const channelCache = new Map();

async function resolveChannel(channelOrName) {
  // Already an ID (starts with C, D, or G) - use directly
  if (/^[CDG][A-Z0-9]+$/.test(channelOrName)) {
    return channelOrName;
  }

  // Normalize: remove # prefix if present
  const channelName = channelOrName.replace(/^#/, '');

  // Check cache
  if (channelCache.has(channelName)) {
    return channelCache.get(channelName);
  }

  // Use search.messages to find the channel by name
  const searchResult = await request('GET', 'search.messages', null, {
    query: `in:${channelName}`,
    count: 1
  });

  if (searchResult.messages?.matches?.length > 0) {
    const channelId = searchResult.messages.matches[0].channel.id;
    channelCache.set(channelName, channelId);
    return channelId;
  }

  throw new Error(`Channel not found: #${channelName}. Make sure the channel has at least one message and you have access to it.`);
}

// ============================================================================
// SLACK API
// ============================================================================

const slack = {
  /**
   * Channel operations
   */
  channels: {
    /**
     * Resolve a channel name or ID to a channel ID.
     * Use this when you need the ID but have a name.
     * All other channel methods call this internally, so you rarely need it directly.
     */
    resolve: async (channelOrName) => resolveChannel(channelOrName),

    /**
     * Find a channel by name. Returns full channel info.
     * Works for public, private, and channels you're a member of.
     */
    find: async (name) => {
      const channelId = await resolveChannel(name);
      const { channel } = await request('GET', 'conversations.info', null, { channel: channelId });
      return channel;
    },

    /**
     * List all channels the bot has access to
     */
    list: (options = {}) => request('GET', 'conversations.list', null, {
      types: options.types || 'public_channel,private_channel,im,mpim',
      exclude_archived: options.excludeArchived !== false,
      limit: options.limit || 100,
      cursor: options.cursor
    }),

    /**
     * Get channel info by ID or name
     */
    info: async (channel) => {
      const channelId = await resolveChannel(channel);
      return request('GET', 'conversations.info', null, { channel: channelId });
    },

    /**
     * Get conversation history (messages)
     */
    history: async (channel, options = {}) => {
      const channelId = await resolveChannel(channel);
      return request('GET', 'conversations.history', null, {
        channel: channelId,
        limit: options.limit || 100,
        cursor: options.cursor,
        oldest: options.oldest,
        latest: options.latest,
        inclusive: options.inclusive
      });
    },

    /**
     * Get thread replies
     */
    replies: async (channel, ts, options = {}) => {
      const channelId = await resolveChannel(channel);
      return request('GET', 'conversations.replies', null, {
        channel: channelId,
        ts,
        limit: options.limit || 100,
        cursor: options.cursor,
        oldest: options.oldest,
        latest: options.latest,
        inclusive: options.inclusive
      });
    },

    /**
     * Join a channel
     */
    join: async (channel) => {
      const channelId = await resolveChannel(channel);
      return request('POST', 'conversations.join', { channel: channelId });
    },

    /**
     * Get channel members
     */
    members: async (channel, options = {}) => {
      const channelId = await resolveChannel(channel);
      return request('GET', 'conversations.members', null, {
        channel: channelId,
        limit: options.limit || 100,
        cursor: options.cursor
      });
    }
  },

  /**
   * Message operations
   */
  messages: {
    /**
     * Send a message to a channel
     */
    send: async (channel, text, options = {}) => {
      const channelId = await resolveChannel(channel);
      return request('POST', 'chat.postMessage', {
        channel: channelId,
        text,
        thread_ts: options.threadTs,
        reply_broadcast: options.replyBroadcast,
        unfurl_links: options.unfurlLinks,
        unfurl_media: options.unfurlMedia,
        mrkdwn: options.mrkdwn !== false,
        blocks: options.blocks,
        attachments: options.attachments
      });
    },

    /**
     * Send a message with Block Kit blocks
     */
    sendBlocks: async (channel, blocks, options = {}) => {
      const channelId = await resolveChannel(channel);
      return request('POST', 'chat.postMessage', {
        channel: channelId,
        blocks,
        text: options.fallbackText || 'Message with blocks',
        thread_ts: options.threadTs,
        reply_broadcast: options.replyBroadcast
      });
    },

    /**
     * Update an existing message
     */
    update: async (channel, ts, text, options = {}) => {
      const channelId = await resolveChannel(channel);
      return request('POST', 'chat.update', {
        channel: channelId,
        ts,
        text,
        blocks: options.blocks,
        attachments: options.attachments
      });
    },

    /**
     * Delete a message
     */
    delete: async (channel, ts) => {
      const channelId = await resolveChannel(channel);
      return request('POST', 'chat.delete', { channel: channelId, ts });
    },

    /**
     * Add a reaction to a message
     */
    react: async (channel, ts, emoji) => {
      const channelId = await resolveChannel(channel);
      return request('POST', 'reactions.add', {
        channel: channelId,
        timestamp: ts,
        name: emoji.replace(/:/g, '')
      });
    },

    /**
     * Remove a reaction from a message
     */
    unreact: async (channel, ts, emoji) => {
      const channelId = await resolveChannel(channel);
      return request('POST', 'reactions.remove', {
        channel: channelId,
        timestamp: ts,
        name: emoji.replace(/:/g, '')
      });
    },

    /**
     * Schedule a message
     */
    schedule: async (channel, text, postAt, options = {}) => {
      const channelId = await resolveChannel(channel);
      return request('POST', 'chat.scheduleMessage', {
        channel: channelId,
        text,
        post_at: Math.floor(postAt instanceof Date ? postAt.getTime() / 1000 : postAt),
        thread_ts: options.threadTs,
        blocks: options.blocks
      });
    },

    /**
     * List scheduled messages
     */
    listScheduled: async (options = {}) => {
      const channelId = options.channel ? await resolveChannel(options.channel) : undefined;
      return request('POST', 'chat.scheduledMessages.list', {
        channel: channelId,
        cursor: options.cursor,
        limit: options.limit || 100,
        oldest: options.oldest,
        latest: options.latest
      });
    },

    /**
     * Delete a scheduled message
     */
    deleteScheduled: async (channel, scheduledMessageId) => {
      const channelId = await resolveChannel(channel);
      return request('POST', 'chat.deleteScheduledMessage', {
        channel: channelId,
        scheduled_message_id: scheduledMessageId
      });
    }
  },

  /**
   * User operations
   */
  users: {
    /**
     * List all users in workspace
     */
    list: (options = {}) => request('GET', 'users.list', null, {
      limit: options.limit || 100,
      cursor: options.cursor,
      include_locale: options.includeLocale
    }),

    /**
     * Get user info by ID
     */
    info: (user) => request('GET', 'users.info', null, { user }),

    /**
     * Look up user by email
     */
    lookupByEmail: (email) => request('GET', 'users.lookupByEmail', null, { email }),

    /**
     * Get current bot user info
     */
    identity: () => request('GET', 'auth.test'),

    /**
     * Get user presence
     */
    presence: (user) => request('GET', 'users.getPresence', null, { user })
  },

  /**
   * Search operations (requires search:read scope)
   */
  search: {
    /**
     * Search messages
     */
    messages: (query, options = {}) => request('GET', 'search.messages', null, {
      query,
      count: options.count || 20,
      page: options.page || 1,
      sort: options.sort || 'timestamp',
      sort_dir: options.sortDir || 'desc'
    }),

    /**
     * Search all (messages and files)
     */
    all: (query, options = {}) => request('GET', 'search.all', null, {
      query,
      count: options.count || 20,
      page: options.page || 1,
      sort: options.sort || 'timestamp',
      sort_dir: options.sortDir || 'desc'
    })
  },

  /**
   * File operations
   */
  files: {
    /**
     * List files
     */
    list: async (options = {}) => {
      const channelId = options.channel ? await resolveChannel(options.channel) : undefined;
      return request('GET', 'files.list', null, {
        channel: channelId,
        user: options.user,
        types: options.types,
        count: options.count || 100,
        page: options.page || 1
      });
    },

    /**
     * Get file info
     */
    info: (file) => request('GET', 'files.info', null, { file }),

    /**
     * Delete a file
     */
    delete: (file) => request('POST', 'files.delete', { file })
  },

  /**
   * Bookmark operations
   */
  bookmarks: {
    /**
     * List bookmarks in a channel
     */
    list: async (channel) => {
      const channelId = await resolveChannel(channel);
      return request('POST', 'bookmarks.list', { channel_id: channelId });
    },

    /**
     * Add a bookmark
     */
    add: async (channel, title, type, options = {}) => {
      const channelId = await resolveChannel(channel);
      return request('POST', 'bookmarks.add', {
        channel_id: channelId,
        title,
        type,
        link: options.link,
        emoji: options.emoji
      });
    },

    /**
     * Remove a bookmark
     */
    remove: async (channel, bookmarkId) => {
      const channelId = await resolveChannel(channel);
      return request('POST', 'bookmarks.remove', {
        channel_id: channelId,
        bookmark_id: bookmarkId
      });
    }
  },

  /**
   * Pin operations
   */
  pins: {
    /**
     * List pinned items in channel
     */
    list: async (channel) => {
      const channelId = await resolveChannel(channel);
      return request('GET', 'pins.list', null, { channel: channelId });
    },

    /**
     * Pin a message
     */
    add: async (channel, ts) => {
      const channelId = await resolveChannel(channel);
      return request('POST', 'pins.add', { channel: channelId, timestamp: ts });
    },

    /**
     * Unpin a message
     */
    remove: async (channel, ts) => {
      const channelId = await resolveChannel(channel);
      return request('POST', 'pins.remove', { channel: channelId, timestamp: ts });
    }
  },

  /**
   * Reminder operations
   */
  reminders: {
    /**
     * Create a reminder
     */
    add: (text, time, options = {}) => request('POST', 'reminders.add', {
      text,
      time: time instanceof Date ? Math.floor(time.getTime() / 1000) : time,
      user: options.user
    }),

    /**
     * List reminders
     */
    list: () => request('GET', 'reminders.list'),

    /**
     * Delete a reminder
     */
    delete: (reminder) => request('POST', 'reminders.delete', { reminder }),

    /**
     * Mark reminder complete
     */
    complete: (reminder) => request('POST', 'reminders.complete', { reminder })
  },

  /**
   * Direct message operations
   */
  dm: {
    /**
     * Open a DM with a user
     */
    open: (users) => request('POST', 'conversations.open', {
      users: Array.isArray(users) ? users.join(',') : users
    }),

    /**
     * Send a DM to a user (opens DM if needed)
     */
    send: async (userId, text, options = {}) => {
      const { channel } = await request('POST', 'conversations.open', { users: userId });
      return request('POST', 'chat.postMessage', {
        channel: channel.id,
        text,
        thread_ts: options.threadTs,
        blocks: options.blocks,
        attachments: options.attachments
      });
    }
  }
};

// ============================================================================
// EXECUTE CODE FROM STDIN
// ============================================================================

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const code = Buffer.concat(chunks).toString('utf-8');

  if (!code.trim()) {
    console.error('No code provided via stdin');
    process.exit(1);
  }

  const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
  const fn = new AsyncFunction('slack', code);
  await fn(slack);
}

main().catch(err => {
  // Print clean error without stack trace for credential/API errors
  console.error(err.message);
  process.exit(1);
});
