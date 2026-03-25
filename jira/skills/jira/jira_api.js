#!/usr/bin/env node
/**
 * Jira API Skill
 *
 * Query and manage Jira issues directly from Claude Code.
 *
 * Credentials (in priority order):
 *   1. Environment variables: JIRA_URL, JIRA_EMAIL, JIRA_API_KEY
 *   2. Credentials file: ~/.jira/credentials (INI format with profiles)
 */

import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PLATFORM = 'jira';
const CREDENTIAL_KEYS = ['JIRA_URL', 'JIRA_EMAIL', 'JIRA_API_KEY'];

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

  const profile = process.env.LAUNCHCODE_PROFILE || 'default';
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
    error += `\nTo use a profile: export LAUNCHCODE_PROFILE=work\n`;
    throw new Error(error);
  }

  return values;
}

// ============================================================================
// LOAD CREDENTIALS
// ============================================================================

const creds = getCredentials(PLATFORM, CREDENTIAL_KEYS);
const baseUrl = creds.JIRA_URL.replace(/\/$/, '');
const email = creds.JIRA_EMAIL;
const apiKey = creds.JIRA_API_KEY;

// ============================================================================
// HTTP CLIENT
// ============================================================================

async function request(method, path, body = null, queryParams = null) {
  let url = `${baseUrl}${path}`;

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
// JIRA API
// ============================================================================

const jira = {
  projects: {
    list: (options = {}) => request('GET', '/rest/api/3/project/search', null, {
      maxResults: options.maxResults || 50,
      startAt: options.startAt || 0,
      orderBy: options.orderBy || 'name',
      expand: options.expand
    }),
    get: (key, options = {}) => request('GET', `/rest/api/3/project/${key}`, null, {
      expand: options.expand
    })
  },

  issues: {
    search: (jql, options = {}) => {
      const body = {
        jql,
        maxResults: options.maxResults || 50,
        fields: options.fields || ['key', 'summary', 'status', 'assignee', 'priority', 'created', 'updated']
      };
      if (options.nextPageToken) body.nextPageToken = options.nextPageToken;
      if (options.expand) body.expand = options.expand;
      return request('POST', '/rest/api/3/search/jql', body);
    },
    get: (key, options = {}) => request('GET', `/rest/api/3/issue/${key}`, null, {
      fields: options.fields?.join(','),
      expand: options.expand
    }),
    update: (key, fields) => request('PUT', `/rest/api/3/issue/${key}`, { fields }),
    updateWithOperations: (key, ops) => request('PUT', `/rest/api/3/issue/${key}`, { update: ops }),
    getTransitions: (key) => request('GET', `/rest/api/3/issue/${key}/transitions`),
    transition: (key, transitionId, fields = null) => {
      const body = { transition: { id: transitionId } };
      if (fields) body.fields = fields;
      return request('POST', `/rest/api/3/issue/${key}/transitions`, body);
    },
    getEditMeta: (key) => request('GET', `/rest/api/3/issue/${key}/editmeta`)
  },

  users: {
    search: (query, options = {}) => request('GET', '/rest/api/3/user/search', null, {
      query,
      maxResults: options.maxResults || 50,
      startAt: options.startAt || 0
    }),
    assignable: (project, options = {}) => request('GET', '/rest/api/3/user/assignable/search', null, {
      project,
      query: options.query || '',
      maxResults: options.maxResults || 50
    })
  },

  fields: {
    list: () => request('GET', '/rest/api/3/field')
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
  const fn = new AsyncFunction('jira', code);
  await fn(jira);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
