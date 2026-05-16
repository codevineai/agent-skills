#!/usr/bin/env node
/**
 * Confluence API Skill
 *
 * Search, read, and create Confluence documentation directly from Claude Code.
 *
 * Credentials (in priority order):
 *   1. Environment variables: CONFLUENCE_URL, CONFLUENCE_EMAIL, CONFLUENCE_API_KEY
 *   2. Credentials file: ~/.confluence/credentials (INI format with profiles)
 */

import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PLATFORM = 'confluence';
const CREDENTIAL_KEYS = ['CONFLUENCE_URL', 'CONFLUENCE_EMAIL', 'CONFLUENCE_API_KEY'];

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

  const profile = process.env.CONFLUENCE_PROFILE || 'default';
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
    error += `\nGet your API token from: https://id.atlassian.com/manage-profile/security/api-tokens\n`;
    error += `\nTo use a profile: export CONFLUENCE_PROFILE=work\n`;
    throw new Error(error);
  }

  return values;
}

// ============================================================================
// LOAD CREDENTIALS
// ============================================================================

const creds = getCredentials(PLATFORM, CREDENTIAL_KEYS);
const baseUrl = creds.CONFLUENCE_URL.replace(/\/$/, '');
const email = creds.CONFLUENCE_EMAIL;
const apiKey = creds.CONFLUENCE_API_KEY;

// ============================================================================
// HTTP CLIENT
// ============================================================================

async function request(method, path, body = null, queryParams = null) {
  let url = `${baseUrl}${path}`;

  if (queryParams) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          params.append(key, value.join(','));
        } else {
          params.append(key, String(value));
        }
      }
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const auth = Buffer.from(`${email}:${apiKey}`).toString('base64');

  const options = {
    method,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const text = await response.text();
    let errorDetail = text;
    try {
      errorDetail = JSON.stringify(JSON.parse(text), null, 2);
    } catch (e) { /* Use raw text */ }
    throw new Error(`${method} ${path} failed (${response.status}):\n${errorDetail}`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// ============================================================================
// CONFLUENCE API
// ============================================================================

const confluence = {
  content: {
    search: (cql, options = {}) => request('GET', '/rest/api/content/search', null, {
      cql,
      limit: options.limit || 25,
      start: options.start || 0,
      expand: options.expand
    }),

    get: (id, options = {}) => request('GET', `/rest/api/content/${id}`, null, {
      expand: options.expand || 'body.storage,version,space,ancestors'
    }),

    getBySpace: (spaceKey, options = {}) => request('GET', '/rest/api/content', null, {
      spaceKey,
      type: options.type || 'page',
      limit: options.limit || 25,
      start: options.start || 0,
      expand: options.expand
    }),

    getChildren: (id, options = {}) => request('GET', `/rest/api/content/${id}/child/page`, null, {
      limit: options.limit || 25,
      start: options.start || 0,
      expand: options.expand || 'version,space'
    }),

    getDescendants: (id, options = {}) => request('GET', `/rest/api/content/${id}/descendant/page`, null, {
      limit: options.limit || 25,
      start: options.start || 0,
      expand: options.expand || 'version,space'
    }),

    getComments: (id, options = {}) => request('GET', `/rest/api/content/${id}/child/comment`, null, {
      limit: options.limit || 100,
      start: options.start || 0,
      expand: options.expand || 'body.storage,version'
    }),

    preview: async (data) => {
      const spaceKey = data.space.key;
      const spaceInfo = await request('GET', `/rest/api/space/${spaceKey}`, null, {
        expand: 'description.plain'
      });

      const contentPreview = data.body.storage.value
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 150);

      console.log('\n' + '='.repeat(60));
      console.log('DOCUMENT PREVIEW');
      console.log('='.repeat(60));
      console.log(`Space:   ${spaceInfo.name} (${spaceInfo.type})`);
      console.log(`Key:     ${spaceKey}`);
      console.log(`Title:   ${data.title}`);
      console.log(`Type:    ${data.type}`);
      console.log(`Content: ${contentPreview}${contentPreview.length >= 150 ? '...' : ''}`);
      console.log('='.repeat(60));
      console.log('\nThis is a PREVIEW. No document has been created yet.');
      console.log('To create, use: confluence.content.create(data)\n');

      return data;
    },

    create: (data) => request('POST', '/rest/api/content', data),

    update: (id, data) => request('PUT', `/rest/api/content/${id}`, data),

    delete: (id) => request('DELETE', `/rest/api/content/${id}`)
  },

  spaces: {
    list: (options = {}) => request('GET', '/rest/api/space', null, {
      type: options.type,
      limit: options.limit || 25,
      start: options.start || 0,
      expand: options.expand
    }),

    get: (key, options = {}) => request('GET', `/rest/api/space/${key}`, null, {
      expand: options.expand || 'description.plain,homepage'
    })
  },

  search: {
    cql: (cql, options = {}) => request('GET', '/rest/api/search', null, {
      cql,
      limit: options.limit || 25,
      start: options.start || 0,
      excerpt: options.excerpt
    })
  },

  user: {
    getCurrent: (options = {}) => request('GET', '/rest/api/user/current', null, {
      expand: options.expand
    }),

    getPersonalSpace: async () => {
      const user = await request('GET', '/rest/api/user/current', null, {
        expand: 'personalSpace'
      });
      if (!user.personalSpace) {
        throw new Error(`No personal space found for user ${user.displayName}`);
      }
      return user.personalSpace;
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
  const fn = new AsyncFunction('confluence', code);
  await fn(confluence);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
