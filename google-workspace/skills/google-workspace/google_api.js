#!/usr/bin/env node
/**
 * Google Workspace API Skill
 *
 * Access Gmail, Google Calendar, and Google Drive from Claude Code.
 * Uses OAuth 2.0 with refresh tokens for authentication.
 *
 * Credentials (in priority order):
 *   1. Environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
 *   2. Credentials file: ~/.google-workspace/credentials (INI format with profiles)
 */

import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PLATFORM = 'google-workspace';
const CREDENTIAL_KEYS = ['GOOGLE_REFRESH_TOKEN'];

// Shared OAuth client — Desktop app type, client secret is not confidential per Google's docs.
// Users only need a GOOGLE_REFRESH_TOKEN in their credentials file.
const DEFAULT_CLIENT_ID = '797454094219-uq1uhvee4p35es9r9k8rt2ph7ac5tbsj.apps.googleusercontent.com';
const DEFAULT_CLIENT_SECRET = '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';

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
      const value = trimmed.slice(eqIndex + 1).trim();
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

  const profile = process.env.GOOGLE_PROFILE || 'default';
  const { profiles, path: credsPath } = loadCredentialsFile(platform);
  const profileData = profiles[profile] || {};

  for (const key of keys) {
    if (process.env[key]) {
      values[key] = process.env[key];
      continue;
    }
    if (profileData[key]) {
      values[key] = profileData[key];
      continue;
    }
    if (profile !== 'default' && profiles['default']?.[key]) {
      values[key] = profiles['default'][key];
      continue;
    }
    missing.push(key);
  }

  if (missing.length > 0) {
    const exampleKeys = keys.map(k => `${k}=your-value-here`).join('\n   ');
    let error = `Missing credentials for ${platform}: ${missing.join(', ')}\n\n`;
    error += `Option 1 - Environment variables:\n`;
    for (const key of missing) error += `   export ${key}="..."\n`;
    error += `\nOption 2 - Credentials file (~/.${platform}/credentials):\n`;
    error += `   [default]\n   ${exampleKeys}\n`;
    error += `\nSetup instructions:\n`;
    error += `  1. Go to https://console.cloud.google.com/apis/credentials\n`;
    error += `  2. Create an OAuth 2.0 Client ID (Desktop app type)\n`;
    error += `  3. Enable Gmail API, Calendar API, and Drive API\n`;
    error += `  4. Run the setup script: node ${CLAUDE_SKILL_DIR}/setup.js\n`;
    error += `\nTo use a profile: export GOOGLE_PROFILE=work\n`;
    throw new Error(error);
  }

  return values;
}

// ============================================================================
// LOAD CREDENTIALS & TOKEN MANAGEMENT
// ============================================================================

const creds = getCredentials(PLATFORM, CREDENTIAL_KEYS);

// Use credentials file values if present, otherwise fall back to built-in defaults
const { profiles } = loadCredentialsFile(PLATFORM);
const profile = process.env.GOOGLE_PROFILE || 'default';
const profileData = profiles[profile] || profiles['default'] || {};
const clientId = process.env.GOOGLE_CLIENT_ID || profileData.GOOGLE_CLIENT_ID || DEFAULT_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET || profileData.GOOGLE_CLIENT_SECRET || DEFAULT_CLIENT_SECRET;
const refreshToken = creds.GOOGLE_REFRESH_TOKEN;

let cachedAccessToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedAccessToken && Date.now() < tokenExpiry - 30000) {
    return cachedAccessToken;
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });

  if (!response.ok) {
    const text = await response.text();
    let parsed = {};
    try { parsed = JSON.parse(text); } catch (e) { /* raw text */ }
    const code = parsed.error || '';
    const desc = parsed.error_description || text;

    let hint = '';
    if (code === 'invalid_grant' || desc.includes('Token has been expired or revoked')) {
      hint = `\n\nYour refresh token is no longer valid. This happens when:\n`
        + `  - You revoked access at https://myaccount.google.com/permissions\n`
        + `  - The token expired (Google refresh tokens for "Testing" apps expire after 7 days)\n`
        + `  - The OAuth client was deleted or recreated\n\n`
        + `Fix: Re-run the setup script:\n`
        + `  node ${CLAUDE_SKILL_DIR}/setup.js\n`;
    } else if (code === 'invalid_client' || desc.includes('unauthorized_client')) {
      hint = `\n\nYour client ID or client secret is wrong.\n\n`
        + `Fix: Check ~/.google-workspace/credentials and verify GOOGLE_CLIENT_ID\n`
        + `and GOOGLE_CLIENT_SECRET match your GCP OAuth client.\n`
        + `Console: https://console.cloud.google.com/apis/credentials\n`;
    } else if (response.status === 403 || desc.includes('access_denied')) {
      hint = `\n\nThe required API is not enabled in your GCP project.\n\n`
        + `Fix: Enable these APIs at https://console.cloud.google.com/apis/library\n`
        + `  - Gmail API\n`
        + `  - Google Calendar API\n`
        + `  - Google Drive API\n`;
    }

    throw new Error(`Token refresh failed (${response.status}): ${desc}${hint}`);
  }

  const data = await response.json();
  cachedAccessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000);
  return cachedAccessToken;
}

// ============================================================================
// HTTP CLIENT
// ============================================================================

async function request(method, url, body = null, queryParams = null, options = {}) {
  const token = await getAccessToken();

  if (queryParams) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          // For repeated params (e.g., fields)
          for (const v of value) params.append(key, String(v));
        } else {
          params.append(key, String(value));
        }
      }
    }
    const qs = params.toString();
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }

  const fetchOptions = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      ...options.headers
    }
  };

  if (body && typeof body === 'string') {
    fetchOptions.body = body;
  } else if (body) {
    fetchOptions.headers['Content-Type'] = 'application/json';
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const text = await response.text();
    let errorDetail = text;
    try {
      errorDetail = JSON.stringify(JSON.parse(text), null, 2);
    } catch (e) { /* Use raw text */ }

    let hint = '';
    if (response.status === 401 || response.status === 403) {
      const lower = errorDetail.toLowerCase();
      if (lower.includes('insufficient') || lower.includes('scope') || lower.includes('permission')) {
        hint = `\n\nThis looks like a missing OAuth scope. Your refresh token may have been`
          + ` granted before this capability was added.\n`
          + `Fix: re-run the setup script to re-consent with the current scopes:\n`
          + `  node ${CLAUDE_SKILL_DIR}/setup.js\n`;
      }
    }

    throw new Error(`${method} ${url} failed (${response.status}):\n${errorDetail}${hint}`);
  }

  if (response.status === 204) return null;

  if (options.raw) {
    return response;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// ============================================================================
// GMAIL API
// ============================================================================

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

// RFC 2822 header encoding for non-ASCII subjects (RFC 2047 encoded-word).
function encodeHeader(value) {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf-8').toString('base64')}?=`;
}

function toAddressList(value) {
  if (!value) return '';
  return Array.isArray(value) ? value.join(', ') : value;
}

// Build a base64url-encoded RFC 2822 message for Gmail send/drafts.
// options: { to, cc, bcc, from, subject, body, html, replyTo, inReplyTo, references }
function buildRawMessage(options = {}) {
  const headers = [];
  const to = toAddressList(options.to);
  const cc = toAddressList(options.cc);
  const bcc = toAddressList(options.bcc);

  if (options.from) headers.push(`From: ${options.from}`);
  if (to) headers.push(`To: ${to}`);
  if (cc) headers.push(`Cc: ${cc}`);
  if (bcc) headers.push(`Bcc: ${bcc}`);
  if (options.replyTo) headers.push(`Reply-To: ${toAddressList(options.replyTo)}`);
  if (options.inReplyTo) headers.push(`In-Reply-To: ${options.inReplyTo}`);
  if (options.references) headers.push(`References: ${options.references}`);
  headers.push(`Subject: ${encodeHeader(options.subject || '')}`);
  headers.push('MIME-Version: 1.0');

  const isHtml = !!options.html;
  const content = isHtml ? options.html : (options.body || '');
  headers.push(`Content-Type: text/${isHtml ? 'html' : 'plain'}; charset="UTF-8"`);
  headers.push('Content-Transfer-Encoding: base64');

  const encodedBody = Buffer.from(content, 'utf-8').toString('base64');
  const mime = headers.join('\r\n') + '\r\n\r\n' + encodedBody;

  // base64url (Gmail requires URL-safe, no padding)
  return Buffer.from(mime, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const gmail = {
  messages: {
    list: (options = {}) => request('GET', `${GMAIL_BASE}/messages`, null, {
      q: options.query || undefined,
      maxResults: options.maxResults || 20,
      pageToken: options.pageToken || undefined,
      labelIds: options.labelIds?.join(',') || undefined
    }),

    get: (id, options = {}) => request('GET', `${GMAIL_BASE}/messages/${id}`, null, {
      format: options.format || 'full'
    }),

    getBody: async (id) => {
      const msg = await request('GET', `${GMAIL_BASE}/messages/${id}`, null, { format: 'full' });
      return extractBody(msg);
    },

    search: async (query, options = {}) => {
      const result = await request('GET', `${GMAIL_BASE}/messages`, null, {
        q: query,
        maxResults: options.maxResults || 10,
        pageToken: options.pageToken || undefined
      });
      if (!result.messages) return { messages: [], resultSizeEstimate: 0 };

      const format = options.format || 'metadata';
      const messages = [];
      for (const stub of result.messages) {
        const msg = await request('GET', `${GMAIL_BASE}/messages/${stub.id}`, null, {
          format,
          // Repeated query param — pass an array so request() emits
          // ?metadataHeaders=From&metadataHeaders=To&... (a joined string gets
          // URL-encoded into one bogus value, which strips all headers).
          metadataHeaders: options.metadataHeaders || ['From', 'To', 'Subject', 'Date']
        });
        // Return parsed summaries so callers read msg.subject/msg.from directly
        // instead of walking payload.headers. payload is retained for power users.
        messages.push(summarizeMessage(msg));
      }
      return {
        messages,
        nextPageToken: result.nextPageToken,
        resultSizeEstimate: result.resultSizeEstimate
      };
    },

    getAttachment: (messageId, attachmentId) =>
      request('GET', `${GMAIL_BASE}/messages/${messageId}/attachments/${attachmentId}`),

    modify: (id, { addLabelIds = [], removeLabelIds = [] } = {}) =>
      request('POST', `${GMAIL_BASE}/messages/${id}/modify`, { addLabelIds, removeLabelIds }),

    batchModify: ({ ids, addLabelIds = [], removeLabelIds = [] } = {}) =>
      request('POST', `${GMAIL_BASE}/messages/batchModify`, { ids, addLabelIds, removeLabelIds }),

    trash: (id) => request('POST', `${GMAIL_BASE}/messages/${id}/trash`),

    batchDelete: (ids) => request('POST', `${GMAIL_BASE}/messages/batchDelete`, { ids }),

    send: (options = {}) => {
      const raw = buildRawMessage(options);
      const body = { raw };
      if (options.threadId) body.threadId = options.threadId;
      return request('POST', `${GMAIL_BASE}/messages/send`, body);
    }
  },

  drafts: {
    list: (options = {}) => request('GET', `${GMAIL_BASE}/drafts`, null, {
      maxResults: options.maxResults || 20,
      pageToken: options.pageToken || undefined
    }),

    get: (id, options = {}) => request('GET', `${GMAIL_BASE}/drafts/${id}`, null, {
      format: options.format || 'full'
    }),

    create: (options = {}) => {
      const raw = buildRawMessage(options);
      const message = { raw };
      if (options.threadId) message.threadId = options.threadId;
      return request('POST', `${GMAIL_BASE}/drafts`, { message });
    },

    send: (id) => request('POST', `${GMAIL_BASE}/drafts/send`, { id }),

    delete: (id) => request('DELETE', `${GMAIL_BASE}/drafts/${id}`)
  },

  labels: {
    list: () => request('GET', `${GMAIL_BASE}/labels`),
    get: (id) => request('GET', `${GMAIL_BASE}/labels/${id}`)
  },

  threads: {
    list: (options = {}) => request('GET', `${GMAIL_BASE}/threads`, null, {
      q: options.query || undefined,
      maxResults: options.maxResults || 20,
      pageToken: options.pageToken || undefined
    }),
    get: (id, options = {}) => request('GET', `${GMAIL_BASE}/threads/${id}`, null, {
      format: options.format || 'full'
    })
  }
};

// Lowercased { headerName: value } map from a Gmail message's payload headers.
function headerMap(msg) {
  const headers = {};
  for (const h of msg.payload?.headers || []) {
    headers[h.name.toLowerCase()] = h.value;
  }
  return headers;
}

// Lightweight parsed summary for search results — common headers lifted to the
// top level so callers never need to walk payload.headers. The raw `payload` is
// retained (its headers are populated in metadata format; parts only in full
// format), and body text is intentionally omitted — use getBody() for that.
function summarizeMessage(msg) {
  const headers = headerMap(msg);
  return {
    id: msg.id,
    threadId: msg.threadId,
    labelIds: msg.labelIds,
    snippet: msg.snippet,
    subject: headers['subject'] || '(no subject)',
    from: headers['from'] || '',
    to: headers['to'] || '',
    date: headers['date'] || '',
    payload: msg.payload
  };
}

// Helper to extract readable body from a Gmail message
function extractBody(msg) {
  const headers = headerMap(msg);

  function decodeBase64Url(data) {
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
  }

  function findParts(payload, mimeType) {
    const results = [];
    if (payload.mimeType === mimeType && payload.body?.data) {
      results.push(decodeBase64Url(payload.body.data));
    }
    if (payload.parts) {
      for (const part of payload.parts) {
        results.push(...findParts(part, mimeType));
      }
    }
    return results;
  }

  function findAttachments(payload) {
    const attachments = [];
    if (payload.filename && payload.body?.attachmentId) {
      attachments.push({
        filename: payload.filename,
        mimeType: payload.mimeType,
        size: payload.body.size,
        attachmentId: payload.body.attachmentId
      });
    }
    if (payload.parts) {
      for (const part of payload.parts) {
        attachments.push(...findAttachments(part));
      }
    }
    return attachments;
  }

  const textParts = findParts(msg.payload, 'text/plain');
  const htmlParts = findParts(msg.payload, 'text/html');
  const attachments = findAttachments(msg.payload);

  return {
    id: msg.id,
    threadId: msg.threadId,
    subject: headers['subject'] || '(no subject)',
    from: headers['from'] || '',
    to: headers['to'] || '',
    date: headers['date'] || '',
    text: textParts.join('\n'),
    html: htmlParts.join('\n'),
    attachments,
    snippet: msg.snippet,
    labelIds: msg.labelIds
  };
}

// ============================================================================
// GOOGLE CALENDAR API
// ============================================================================

const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';

const calendar = {
  calendars: {
    list: () => request('GET', `${CALENDAR_BASE}/users/me/calendarList`),
    get: (calendarId = 'primary') => request('GET', `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}`)
  },

  events: {
    list: (options = {}) => {
      const calendarId = options.calendarId || 'primary';
      return request('GET', `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`, null, {
        timeMin: options.timeMin || undefined,
        timeMax: options.timeMax || undefined,
        maxResults: options.maxResults || 50,
        singleEvents: options.singleEvents !== false ? 'true' : 'false',
        orderBy: options.orderBy || 'startTime',
        q: options.query || undefined,
        pageToken: options.pageToken || undefined
      });
    },

    get: (eventId, options = {}) => {
      const calendarId = options.calendarId || 'primary';
      return request('GET', `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`);
    },

    search: (query, options = {}) => {
      const calendarId = options.calendarId || 'primary';
      return request('GET', `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`, null, {
        q: query,
        timeMin: options.timeMin || undefined,
        timeMax: options.timeMax || undefined,
        maxResults: options.maxResults || 20,
        singleEvents: 'true',
        orderBy: 'startTime',
        pageToken: options.pageToken || undefined
      });
    },

    delete: (eventId, options = {}) => {
      const calendarId = options.calendarId || 'primary';
      return request('DELETE', `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`);
    }
  }
};

// ============================================================================
// GOOGLE DRIVE API
// ============================================================================

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';

const drive = {
  files: {
    list: (options = {}) => request('GET', `${DRIVE_BASE}/files`, null, {
      q: options.query || undefined,
      pageSize: options.pageSize || 20,
      fields: options.fields || 'nextPageToken, files(id, name, mimeType, modifiedTime, size, webViewLink, parents)',
      orderBy: options.orderBy || 'modifiedTime desc',
      pageToken: options.pageToken || undefined,
      spaces: options.spaces || 'drive',
      supportsAllDrives: options.includeSharedDrives ? 'true' : undefined,
      includeItemsFromAllDrives: options.includeSharedDrives ? 'true' : undefined
    }),

    get: (fileId, options = {}) => request('GET', `${DRIVE_BASE}/files/${fileId}`, null, {
      fields: options.fields || 'id, name, mimeType, modifiedTime, size, webViewLink, parents, description',
      supportsAllDrives: 'true'
    }),

    getContent: async (fileId) => {
      const token = await getAccessToken();
      const response = await fetch(`${DRIVE_BASE}/files/${fileId}?alt=media`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error(`Download failed (${response.status}): ${await response.text()}`);
      }
      return response.text();
    },

    exportAsText: async (fileId, mimeType = 'text/plain') => {
      const token = await getAccessToken();
      const response = await fetch(`${DRIVE_BASE}/files/${fileId}/export?mimeType=${encodeURIComponent(mimeType)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error(`Export failed (${response.status}): ${await response.text()}`);
      }
      return response.text();
    },

    search: (name, options = {}) => {
      const conditions = [`name contains '${name.replace(/'/g, "\\'")}'`];
      if (options.mimeType) conditions.push(`mimeType = '${options.mimeType}'`);
      if (options.folderId) conditions.push(`'${options.folderId}' in parents`);
      conditions.push('trashed = false');

      return drive.files.list({
        query: conditions.join(' and '),
        pageSize: options.pageSize || 20,
        fields: options.fields,
        includeSharedDrives: options.includeSharedDrives
      });
    }
  },

  permissions: {
    list: (fileId) => request('GET', `${DRIVE_BASE}/files/${fileId}/permissions`, null, {
      fields: 'permissions(id, type, role, emailAddress, displayName)',
      supportsAllDrives: 'true'
    })
  },

  about: {
    get: () => request('GET', `${DRIVE_BASE}/about`, null, {
      fields: 'user, storageQuota'
    })
  }
};

// ============================================================================
// GOOGLE PEOPLE API
// ============================================================================

const PEOPLE_BASE = 'https://people.googleapis.com/v1';
const CONTACTS_CACHE_PATH = join(homedir(), '.google-workspace', 'contacts-cache.json');

// ---- Known Senders Cache (lazy-loaded, singleton per script run) ----

let _knownSendersSet = null;   // Set<string> — lowercase emails
let _cacheData = null;         // raw JSON structure
let _syncDone = false;         // ensures sync happens only once per run

function loadCache() {
  try {
    if (existsSync(CONTACTS_CACHE_PATH)) {
      return JSON.parse(readFileSync(CONTACTS_CACHE_PATH, 'utf-8'));
    }
  } catch (e) { /* corrupt file — start fresh */ }
  return { connectionsSyncToken: null, otherContactsSyncToken: null, lastSync: null, syncedEmails: [], manualEmails: [] };
}

function saveCache(data) {
  const dir = join(homedir(), '.google-workspace');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(CONTACTS_CACHE_PATH, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function extractEmails(person) {
  return (person.emailAddresses || []).map(e => e.value.toLowerCase());
}

async function fullSyncConnections() {
  const emails = [];
  let pageToken = undefined;
  let syncToken = null;
  do {
    const result = await request('GET', `${PEOPLE_BASE}/people/me/connections`, null, {
      personFields: 'emailAddresses',
      pageSize: 1000,
      pageToken,
      requestSyncToken: 'true'
    });
    if (result.connections) {
      for (const c of result.connections) emails.push(...extractEmails(c));
    }
    pageToken = result.nextPageToken;
    if (result.nextSyncToken) syncToken = result.nextSyncToken;
  } while (pageToken);
  return { emails, syncToken };
}

async function incrementalSyncConnections(syncToken) {
  const added = [];
  const removed = [];
  let pageToken = undefined;
  let newSyncToken = null;
  do {
    const result = await request('GET', `${PEOPLE_BASE}/people/me/connections`, null, {
      personFields: 'emailAddresses',
      pageSize: 1000,
      pageToken,
      requestSyncToken: 'true',
      syncToken
    });
    if (result.connections) {
      for (const c of result.connections) {
        const emails = extractEmails(c);
        if (c.metadata?.deleted) {
          removed.push(...emails);
        } else {
          added.push(...emails);
        }
      }
    }
    pageToken = result.nextPageToken;
    if (result.nextSyncToken) newSyncToken = result.nextSyncToken;
  } while (pageToken);
  return { added, removed, syncToken: newSyncToken };
}

async function fullSyncOtherContacts() {
  const emails = [];
  let pageToken = undefined;
  let syncToken = null;
  do {
    const result = await request('GET', `${PEOPLE_BASE}/otherContacts`, null, {
      readMask: 'emailAddresses',
      pageSize: 1000,
      pageToken,
      requestSyncToken: 'true'
    });
    if (result.otherContacts) {
      for (const c of result.otherContacts) emails.push(...extractEmails(c));
    }
    pageToken = result.nextPageToken;
    if (result.nextSyncToken) syncToken = result.nextSyncToken;
  } while (pageToken);
  return { emails, syncToken };
}

async function incrementalSyncOtherContacts(syncToken) {
  const added = [];
  const removed = [];
  let pageToken = undefined;
  let newSyncToken = null;
  do {
    const result = await request('GET', `${PEOPLE_BASE}/otherContacts`, null, {
      readMask: 'emailAddresses',
      pageSize: 1000,
      pageToken,
      requestSyncToken: 'true',
      syncToken
    });
    if (result.otherContacts) {
      for (const c of result.otherContacts) {
        const emails = extractEmails(c);
        if (c.metadata?.deleted) {
          removed.push(...emails);
        } else {
          added.push(...emails);
        }
      }
    }
    pageToken = result.nextPageToken;
    if (result.nextSyncToken) newSyncToken = result.nextSyncToken;
  } while (pageToken);
  return { added, removed, syncToken: newSyncToken };
}

async function syncKnownSenders() {
  if (_syncDone) return;
  _syncDone = true;

  _cacheData = loadCache();
  const existingSynced = new Set(_cacheData.syncedEmails || []);

  // --- Connections sync ---
  if (_cacheData.connectionsSyncToken) {
    try {
      const delta = await incrementalSyncConnections(_cacheData.connectionsSyncToken);
      for (const e of delta.added) existingSynced.add(e);
      for (const e of delta.removed) existingSynced.delete(e);
      _cacheData.connectionsSyncToken = delta.syncToken || _cacheData.connectionsSyncToken;
    } catch (err) {
      if (err.message.includes('410') || err.message.includes('GONE') || err.message.includes('Sync token')) {
        // Token expired — full re-sync, but keep existing emails until replaced
        const full = await fullSyncConnections();
        // Don't clear — merge new full set with existing (other contacts still there)
        // But we do want to replace connections portion. We can't distinguish, so just add all.
        for (const e of full.emails) existingSynced.add(e);
        _cacheData.connectionsSyncToken = full.syncToken;
      } else {
        throw err;
      }
    }
  } else {
    const full = await fullSyncConnections();
    for (const e of full.emails) existingSynced.add(e);
    _cacheData.connectionsSyncToken = full.syncToken;
  }

  // --- Other Contacts sync ---
  if (_cacheData.otherContactsSyncToken) {
    try {
      const delta = await incrementalSyncOtherContacts(_cacheData.otherContactsSyncToken);
      for (const e of delta.added) existingSynced.add(e);
      for (const e of delta.removed) existingSynced.delete(e);
      _cacheData.otherContactsSyncToken = delta.syncToken || _cacheData.otherContactsSyncToken;
    } catch (err) {
      if (err.message.includes('410') || err.message.includes('GONE') || err.message.includes('Sync token')) {
        const full = await fullSyncOtherContacts();
        for (const e of full.emails) existingSynced.add(e);
        _cacheData.otherContactsSyncToken = full.syncToken;
      } else {
        throw err;
      }
    }
  } else {
    const full = await fullSyncOtherContacts();
    for (const e of full.emails) existingSynced.add(e);
    _cacheData.otherContactsSyncToken = full.syncToken;
  }

  // Save synced emails back
  _cacheData.syncedEmails = [...existingSynced].sort();
  _cacheData.lastSync = new Date().toISOString();
  saveCache(_cacheData);

  // Build in-memory set: union of synced + manual
  _knownSendersSet = new Set([..._cacheData.syncedEmails, ...(_cacheData.manualEmails || [])]);
}

const people = {
  connections: {
    list: async (options = {}) => {
      const allContacts = [];
      let pageToken = undefined;
      do {
        const result = await request('GET', `${PEOPLE_BASE}/people/me/connections`, null, {
          personFields: options.personFields || 'names,emailAddresses',
          pageSize: options.pageSize || 1000,
          pageToken
        });
        if (result.connections) allContacts.push(...result.connections);
        pageToken = result.nextPageToken;
      } while (pageToken && !options.singlePage);
      return { connections: allContacts };
    }
  },

  otherContacts: {
    list: async (options = {}) => {
      const allContacts = [];
      let pageToken = undefined;
      do {
        const result = await request('GET', `${PEOPLE_BASE}/otherContacts`, null, {
          readMask: options.readMask || 'names,emailAddresses',
          pageSize: options.pageSize || 1000,
          pageToken
        });
        if (result.otherContacts) allContacts.push(...result.otherContacts);
        pageToken = result.nextPageToken;
      } while (pageToken && !options.singlePage);
      return { otherContacts: allContacts };
    },

    search: (query, options = {}) => request('GET', `${PEOPLE_BASE}/otherContacts:search`, null, {
      query,
      readMask: options.readMask || 'names,emailAddresses',
      pageSize: options.pageSize || 30
    })
  },

  isKnownSender: async (email) => {
    await syncKnownSenders();
    return _knownSendersSet.has(email.toLowerCase());
  },

  addKnownSender: async (email) => {
    await syncKnownSenders();
    const lower = email.toLowerCase();
    _knownSendersSet.add(lower);
    if (!_cacheData.manualEmails) _cacheData.manualEmails = [];
    if (!_cacheData.manualEmails.includes(lower)) {
      _cacheData.manualEmails.push(lower);
      _cacheData.manualEmails.sort();
      saveCache(_cacheData);
    }
  }
};

// ============================================================================
// GMAIL UTILITY HELPERS
// ============================================================================

const RULES_PATH = join(homedir(), '.google-workspace', 'inbox-rules.md');

// Label cache: name -> id
let _labelCache = null;

async function ensureLabel(labelName) {
  if (!_labelCache) {
    const result = await gmail.labels.list();
    _labelCache = {};
    for (const l of result.labels) _labelCache[l.name] = l.id;
  }
  if (_labelCache[labelName]) return _labelCache[labelName];

  // Create the label
  const created = await request('POST', `${GMAIL_BASE}/labels`, {
    name: labelName,
    labelListVisibility: 'labelShow',
    messageListVisibility: 'show'
  });
  _labelCache[created.name] = created.id;
  return created.id;
}

// Attach ensureLabel to gmail object
gmail.ensureLabel = ensureLabel;

// Banish sender — appends to the Banished Senders section of inbox-rules.md
gmail.banishSender = async (emailOrDomain) => {
  if (!existsSync(RULES_PATH)) return;
  let content = readFileSync(RULES_PATH, 'utf-8');
  const lower = emailOrDomain.toLowerCase();

  // Find end of banished section (next ## heading)
  const banishedIdx = content.indexOf('## Banished Senders');
  if (banishedIdx === -1) return;
  const afterBanished = content.indexOf('\n## ', banishedIdx + 1);

  const beforeNext = afterBanished === -1 ? content : content.slice(0, afterBanished);
  const rest = afterBanished === -1 ? '' : content.slice(afterBanished);

  if (beforeNext.includes(lower)) return; // already there

  content = beforeNext.trimEnd() + '\n- ' + lower + '\n' + rest;
  writeFileSync(RULES_PATH, content);
};

// ============================================================================
// COMBINED API OBJECT
// ============================================================================

const api = { gmail, calendar, drive, people };

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
  const fn = new AsyncFunction('api', 'gmail', 'calendar', 'drive', 'people', code);
  await fn(api, gmail, calendar, drive, people);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
