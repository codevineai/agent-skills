#!/usr/bin/env node
/**
 * Google Workspace API Skill
 *
 * Access Gmail, Google Calendar, Google Drive, Sheets, Docs, Slides, Tasks,
 * and Contacts from Claude Code.
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
    error += `  3. Enable the Gmail, Calendar, Drive, People, Sheets, Docs, Slides, and Tasks APIs\n`;
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
        + `  - Google Drive API\n`
        + `  - People API\n`
        + `  - Google Sheets API, Google Docs API, Google Slides API, Google Tasks API\n`;
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
      if (lower.includes('accessnotconfigured') || lower.includes('service_disabled') || lower.includes('it is disabled')) {
        hint = `\n\nThis API is not enabled in the OAuth client's GCP project.\n`
          + `Fix: open the enable link in the error above, enable the API, wait a minute, and retry.\n`;
      } else if (lower.includes('insufficient') || lower.includes('scope') || lower.includes('permission')) {
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

    // Create an event. `event` is a Google Calendar Event resource:
    //   { summary, description, location, start, end, attendees, reminders, ... }
    // start/end are { dateTime, timeZone } or { date } for all-day.
    // options: { calendarId, sendUpdates: 'all'|'externalOnly'|'none', conferenceData }
    create: (event, options = {}) => {
      const calendarId = options.calendarId || 'primary';
      const query = {
        sendUpdates: options.sendUpdates || undefined,
        conferenceDataVersion: options.conferenceData ? 1 : undefined,
        supportsAttachments: event.attachments ? 'true' : undefined
      };
      return request('POST', `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`, event, query);
    },

    // Full-replace update (PUT). Provide the complete event resource.
    update: (eventId, event, options = {}) => {
      const calendarId = options.calendarId || 'primary';
      const query = {
        sendUpdates: options.sendUpdates || undefined,
        conferenceDataVersion: options.conferenceData ? 1 : undefined,
        supportsAttachments: event.attachments ? 'true' : undefined
      };
      return request('PUT', `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, event, query);
    },

    // Partial update (PATCH). Provide only the fields to change.
    patch: (eventId, fields, options = {}) => {
      const calendarId = options.calendarId || 'primary';
      const query = {
        sendUpdates: options.sendUpdates || undefined,
        conferenceDataVersion: options.conferenceData ? 1 : undefined,
        supportsAttachments: fields.attachments ? 'true' : undefined
      };
      return request('PATCH', `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, fields, query);
    },

    delete: (eventId, options = {}) => {
      const calendarId = options.calendarId || 'primary';
      const query = { sendUpdates: options.sendUpdates || undefined };
      return request('DELETE', `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, null, query);
    },

    // Move an event to another calendar. Returns the moved event.
    move: (eventId, destinationCalendarId, options = {}) => {
      const calendarId = options.calendarId || 'primary';
      const query = {
        destination: destinationCalendarId,
        sendUpdates: options.sendUpdates || undefined
      };
      return request('POST', `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}/move`, null, query);
    },

    // Create an event from a natural-language string, e.g.
    //   "Lunch with Sara at Schenck School 3pm Aug 19".
    quickAdd: (text, options = {}) => {
      const calendarId = options.calendarId || 'primary';
      const query = { text, sendUpdates: options.sendUpdates || undefined };
      return request('POST', `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/quickAdd`, null, query);
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
// GOOGLE SHEETS API
// ============================================================================

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

const valuesUrl = (spreadsheetId, range, suffix = '') =>
  `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}${suffix}`;

const sheets = {
  spreadsheets: {
    // Metadata: title, sheets (tabs) with sheetId/title/gridProperties. Cell data
    // only when options.includeGridData is true — use values.get for cell values.
    get: (spreadsheetId, options = {}) => request('GET', `${SHEETS_BASE}/${spreadsheetId}`, null, {
      ranges: options.ranges || undefined,
      includeGridData: options.includeGridData ? 'true' : undefined,
      fields: options.fields || undefined
    }),

    // options: { title, sheets: ['Tab name', ...] }
    create: (options = {}) => {
      const body = { properties: { title: options.title || 'Untitled spreadsheet' } };
      if (options.sheets) body.sheets = options.sheets.map(title => ({ properties: { title } }));
      return request('POST', SHEETS_BASE, body);
    },

    // Structural/formatting changes. `requests` is an array of Sheets Request objects
    // (addSheet, deleteSheet, updateCells, repeatCell, mergeCells, ...).
    batchUpdate: (spreadsheetId, requests, options = {}) =>
      request('POST', `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
        requests,
        includeSpreadsheetInResponse: options.includeSpreadsheetInResponse || undefined
      })
  },

  values: {
    // range is A1 notation: 'Sheet1!A1:D20', 'Sheet1', 'A:C'
    get: (spreadsheetId, range, options = {}) => request('GET', valuesUrl(spreadsheetId, range), null, {
      majorDimension: options.majorDimension || undefined,
      valueRenderOption: options.valueRenderOption || undefined,
      dateTimeRenderOption: options.dateTimeRenderOption || undefined
    }),

    batchGet: (spreadsheetId, ranges, options = {}) =>
      request('GET', `${SHEETS_BASE}/${spreadsheetId}/values:batchGet`, null, {
        ranges,
        majorDimension: options.majorDimension || undefined,
        valueRenderOption: options.valueRenderOption || undefined,
        dateTimeRenderOption: options.dateTimeRenderOption || undefined
      }),

    // Overwrite a range. values is a 2D array (rows of cells).
    // valueInputOption: 'USER_ENTERED' (default; parses formulas/dates/numbers) or 'RAW'.
    update: (spreadsheetId, range, values, options = {}) =>
      request('PUT', valuesUrl(spreadsheetId, range), { range, majorDimension: options.majorDimension || undefined, values }, {
        valueInputOption: options.valueInputOption || 'USER_ENTERED'
      }),

    // Append rows after the last row of the table found in `range`.
    append: (spreadsheetId, range, values, options = {}) =>
      request('POST', valuesUrl(spreadsheetId, range, ':append'), { majorDimension: options.majorDimension || undefined, values }, {
        valueInputOption: options.valueInputOption || 'USER_ENTERED',
        insertDataOption: options.insertDataOption || undefined
      }),

    // Clear values (formatting is kept).
    clear: (spreadsheetId, range) => request('POST', valuesUrl(spreadsheetId, range, ':clear'), {}),

    // Write several ranges in one call. data: [{ range, values }, ...]
    batchUpdate: (spreadsheetId, data, options = {}) =>
      request('POST', `${SHEETS_BASE}/${spreadsheetId}/values:batchUpdate`, {
        valueInputOption: options.valueInputOption || 'USER_ENTERED',
        data
      })
  },

  // Add a tab. Returns the new sheet's properties ({ sheetId, title, index, ... }).
  addSheet: async (spreadsheetId, title, options = {}) => {
    const properties = { title };
    if (options.index !== undefined) properties.index = options.index;
    const result = await sheets.spreadsheets.batchUpdate(spreadsheetId, [{ addSheet: { properties } }]);
    return result.replies[0].addSheet.properties;
  },

  // Delete a tab by numeric sheetId (from spreadsheets.get, not the tab title).
  deleteSheet: (spreadsheetId, sheetId) =>
    sheets.spreadsheets.batchUpdate(spreadsheetId, [{ deleteSheet: { sheetId } }])
};

// ============================================================================
// GOOGLE DOCS API
// ============================================================================

const DOCS_BASE = 'https://docs.googleapis.com/v1/documents';

// Plain text of a Docs body (array of StructuralElements). Table cells are
// tab-separated, one row per line.
function docContentText(content) {
  let out = '';
  for (const el of content || []) {
    if (el.paragraph) {
      for (const pe of el.paragraph.elements || []) {
        if (pe.textRun?.content) out += pe.textRun.content;
      }
    } else if (el.table) {
      for (const row of el.table.tableRows || []) {
        const cells = (row.tableCells || []).map(c => docContentText(c.content).replace(/\n+$/, ''));
        out += cells.join('\t') + '\n';
      }
    } else if (el.tableOfContents) {
      out += docContentText(el.tableOfContents.content);
    }
  }
  return out;
}

// Depth-first list of a document's tabs, child tabs included.
function flattenDocTabs(tabs) {
  const out = [];
  for (const tab of tabs || []) {
    out.push(tab);
    out.push(...flattenDocTabs(tab.childTabs));
  }
  return out;
}

const docs = {
  documents: {
    get: (documentId, options = {}) => request('GET', `${DOCS_BASE}/${documentId}`, null, {
      includeTabsContent: options.includeTabsContent ? 'true' : undefined,
      suggestionsViewMode: options.suggestionsViewMode || undefined,
      fields: options.fields || undefined
    }),

    // options: { title }. Creates an empty document; add content with appendText/batchUpdate.
    create: (options = {}) => request('POST', DOCS_BASE, { title: options.title || 'Untitled document' }),

    // `requests` is an array of Docs Request objects (insertText, replaceAllText,
    // updateTextStyle, insertTable, deleteContentRange, ...).
    batchUpdate: (documentId, requests, options = {}) =>
      request('POST', `${DOCS_BASE}/${documentId}:batchUpdate`, {
        requests,
        writeControl: options.writeControl || undefined
      })
  },

  // Plain text of the document. All tabs by default (joined in order);
  // options.tabId selects one tab.
  getText: async (documentId, options = {}) => {
    const doc = await docs.documents.get(documentId, { includeTabsContent: true });
    let tabs = flattenDocTabs(doc.tabs);
    if (options.tabId) {
      tabs = tabs.filter(t => t.tabProperties?.tabId === options.tabId);
      if (!tabs.length) throw new Error(`Tab ${options.tabId} not found in document ${documentId}`);
    }
    return tabs.map(t => docContentText(t.documentTab?.body?.content)).join('\n');
  },

  // Append text at the end of the body. options: { tabId }
  appendText: (documentId, text, options = {}) =>
    docs.documents.batchUpdate(documentId, [{
      insertText: { text, endOfSegmentLocation: options.tabId ? { tabId: options.tabId } : {} }
    }]),

  // Insert text at a character index (1 = start of body). options: { tabId }
  insertText: (documentId, text, index, options = {}) =>
    docs.documents.batchUpdate(documentId, [{
      insertText: { text, location: { index, ...(options.tabId ? { tabId: options.tabId } : {}) } }
    }]),

  // Replace every occurrence of `find`. Returns the number of replacements.
  replaceText: async (documentId, find, replacement, options = {}) => {
    const result = await docs.documents.batchUpdate(documentId, [{
      replaceAllText: {
        containsText: { text: find, matchCase: options.matchCase !== false },
        replaceText: replacement
      }
    }]);
    return result.replies?.[0]?.replaceAllText?.occurrencesChanged || 0;
  }
};

// ============================================================================
// GOOGLE SLIDES API
// ============================================================================

const SLIDES_BASE = 'https://slides.googleapis.com/v1/presentations';

function slideTextContent(text) {
  return (text?.textElements || []).map(te => te.textRun?.content || '').join('');
}

// Plain text of a page's elements: shapes, tables (tab-separated cells), and groups.
function pageElementsText(elements) {
  let out = '';
  for (const el of elements || []) {
    if (el.shape?.text) {
      out += slideTextContent(el.shape.text);
    } else if (el.table) {
      for (const row of el.table.tableRows || []) {
        const cells = (row.tableCells || []).map(c => slideTextContent(c.text).replace(/\n+$/, ''));
        out += cells.join('\t') + '\n';
      }
    } else if (el.elementGroup) {
      out += pageElementsText(el.elementGroup.children);
    }
  }
  return out;
}

function speakerNotesText(slide) {
  const notesPage = slide.slideProperties?.notesPage;
  const notesId = notesPage?.notesProperties?.speakerNotesObjectId;
  const shape = (notesPage?.pageElements || []).find(el => el.objectId === notesId);
  return slideTextContent(shape?.shape?.text);
}

const slides = {
  presentations: {
    get: (presentationId, options = {}) => request('GET', `${SLIDES_BASE}/${presentationId}`, null, {
      fields: options.fields || undefined
    }),

    // options: { title }
    create: (options = {}) => request('POST', SLIDES_BASE, { title: options.title || 'Untitled presentation' }),

    // `requests` is an array of Slides Request objects (createSlide, insertText,
    // replaceAllText, createShape, createImage, deleteObject, ...).
    batchUpdate: (presentationId, requests, options = {}) =>
      request('POST', `${SLIDES_BASE}/${presentationId}:batchUpdate`, {
        requests,
        writeControl: options.writeControl || undefined
      })
  },

  pages: {
    get: (presentationId, pageId) => request('GET', `${SLIDES_BASE}/${presentationId}/pages/${pageId}`),

    // Returns { contentUrl, width, height }. contentUrl is a short-lived PNG URL.
    // options: { size: 'SMALL'|'MEDIUM'|'LARGE', mimeType: 'PNG' }
    getThumbnail: (presentationId, pageId, options = {}) =>
      request('GET', `${SLIDES_BASE}/${presentationId}/pages/${pageId}/thumbnail`, null, {
        'thumbnailProperties.thumbnailSize': options.size || undefined,
        'thumbnailProperties.mimeType': options.mimeType || undefined
      })
  },

  // Text of every slide: [{ index, objectId, text, notes }]. index is 1-based.
  getText: async (presentationId) => {
    const deck = await slides.presentations.get(presentationId);
    return (deck.slides || []).map((slide, i) => ({
      index: i + 1,
      objectId: slide.objectId,
      text: pageElementsText(slide.pageElements),
      notes: speakerNotesText(slide)
    }));
  },

  // Add a slide. options: { layout: predefined layout name (default 'BLANK'), insertionIndex, objectId }
  // Returns the new slide's objectId.
  addSlide: async (presentationId, options = {}) => {
    const createSlide = { slideLayoutReference: { predefinedLayout: options.layout || 'BLANK' } };
    if (options.insertionIndex !== undefined) createSlide.insertionIndex = options.insertionIndex;
    if (options.objectId) createSlide.objectId = options.objectId;
    const result = await slides.presentations.batchUpdate(presentationId, [{ createSlide }]);
    return result.replies[0].createSlide.objectId;
  },

  // Replace every occurrence of `find` across the deck. Returns the number of replacements.
  replaceText: async (presentationId, find, replacement, options = {}) => {
    const result = await slides.presentations.batchUpdate(presentationId, [{
      replaceAllText: {
        containsText: { text: find, matchCase: options.matchCase !== false },
        replaceText: replacement,
        pageObjectIds: options.pageObjectIds || undefined
      }
    }]);
    return result.replies?.[0]?.replaceAllText?.occurrencesChanged || 0;
  }
};

// ============================================================================
// GOOGLE TASKS API
// ============================================================================

const TASKS_BASE = 'https://tasks.googleapis.com/tasks/v1';

// Task list IDs are URL-safe; '@default' must stay unescaped.
const taskListUrl = (options = {}) => `${TASKS_BASE}/lists/${options.tasklistId || '@default'}`;

const tasks = {
  tasklists: {
    list: (options = {}) => request('GET', `${TASKS_BASE}/users/@me/lists`, null, {
      maxResults: options.maxResults || 100,
      pageToken: options.pageToken || undefined
    }),
    get: (tasklistId = '@default') => request('GET', `${TASKS_BASE}/users/@me/lists/${tasklistId}`),
    create: (options = {}) => request('POST', `${TASKS_BASE}/users/@me/lists`, { title: options.title }),
    patch: (tasklistId, fields) => request('PATCH', `${TASKS_BASE}/users/@me/lists/${tasklistId}`, fields),
    delete: (tasklistId) => request('DELETE', `${TASKS_BASE}/users/@me/lists/${tasklistId}`)
  },

  // Every method takes options.tasklistId (default '@default', the user's primary list).
  tasks: {
    list: (options = {}) => request('GET', `${taskListUrl(options)}/tasks`, null, {
      maxResults: options.maxResults || 100,
      pageToken: options.pageToken || undefined,
      showCompleted: options.showCompleted === false ? 'false' : undefined,
      showHidden: options.showHidden ? 'true' : undefined,
      showDeleted: options.showDeleted ? 'true' : undefined,
      dueMin: options.dueMin || undefined,
      dueMax: options.dueMax || undefined,
      completedMin: options.completedMin || undefined,
      completedMax: options.completedMax || undefined,
      updatedMin: options.updatedMin || undefined
    }),

    get: (taskId, options = {}) => request('GET', `${taskListUrl(options)}/tasks/${taskId}`),

    // task: { title, notes, due (RFC 3339; the API keeps the date only), status }
    // options: { tasklistId, parent (task ID, makes a subtask), previous (sibling task ID to insert after) }
    create: (task, options = {}) => request('POST', `${taskListUrl(options)}/tasks`, task, {
      parent: options.parent || undefined,
      previous: options.previous || undefined
    }),

    // Partial update (PATCH). Provide only the fields to change.
    patch: (taskId, fields, options = {}) => request('PATCH', `${taskListUrl(options)}/tasks/${taskId}`, fields),

    // Full-replace update (PUT). Provide the complete task resource, including id.
    update: (taskId, task, options = {}) => request('PUT', `${taskListUrl(options)}/tasks/${taskId}`, task),

    delete: (taskId, options = {}) => request('DELETE', `${taskListUrl(options)}/tasks/${taskId}`),

    complete: (taskId, options = {}) => tasks.tasks.patch(taskId, { status: 'completed' }, options),

    reopen: (taskId, options = {}) => tasks.tasks.patch(taskId, { status: 'needsAction', completed: null }, options),

    // Reorder, re-parent, or move to another list.
    // options: { tasklistId, parent, previous, destinationTasklist }
    move: (taskId, options = {}) => request('POST', `${taskListUrl(options)}/tasks/${taskId}/move`, null, {
      parent: options.parent || undefined,
      previous: options.previous || undefined,
      destinationTasklist: options.destinationTasklist || undefined
    }),

    // Hide all completed tasks in the list.
    clearCompleted: (options = {}) => request('POST', `${taskListUrl(options)}/clear`)
  }
};

// ============================================================================
// COMBINED API OBJECT
// ============================================================================

const api = { gmail, calendar, drive, people, sheets, docs, slides, tasks };

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
  const fn = new AsyncFunction('api', 'gmail', 'calendar', 'drive', 'people', 'sheets', 'docs', 'slides', 'tasks', code);
  await fn(api, gmail, calendar, drive, people, sheets, docs, slides, tasks);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
