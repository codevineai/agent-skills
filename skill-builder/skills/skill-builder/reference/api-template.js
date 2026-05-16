#!/usr/bin/env node
/**
 * API Skill Template
 *
 * Copy this file and customize for your API.
 * The credentials helper is included inline - no external dependencies.
 *
 * Customize:
 *   1. PLATFORM and CREDENTIAL_KEYS at the top
 *   2. Authentication method in request()
 *   3. API object with your endpoints
 */

import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

// ============================================================================
// CUSTOMIZE THESE FOR YOUR API
// ============================================================================

const PLATFORM = 'myplatform';  // Used for credentials file: ~/.myplatform/credentials
const CREDENTIAL_KEYS = ['MYPLATFORM_URL', 'MYPLATFORM_API_KEY'];

// ============================================================================
// CREDENTIALS HELPER (included inline for self-contained skills)
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

  const profile = process.env.MYPLATFORM_PROFILE || 'default';
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
    error += `\nTo use a profile: export MYPLATFORM_PROFILE=work\n`;
    throw new Error(error);
  }

  return values;
}

// ============================================================================
// LOAD CREDENTIALS
// ============================================================================

const creds = getCredentials(PLATFORM, CREDENTIAL_KEYS);
const baseUrl = creds.MYPLATFORM_URL.replace(/\/$/, '');
const apiKey = creds.MYPLATFORM_API_KEY;

// ============================================================================
// HTTP CLIENT - Customize authentication as needed
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

  const options = {
    method,
    headers: {
      // CUSTOMIZE: Change auth method as needed
      // Bearer token:
      'Authorization': `Bearer ${apiKey}`,
      // Basic auth (uncomment and use instead):
      // 'Authorization': `Basic ${Buffer.from(`${email}:${apiKey}`).toString('base64')}`,
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
// API OBJECT - Customize with your endpoints
// ============================================================================

const api = {
  // Example: resources domain
  resources: {
    list: (options = {}) => request('GET', '/resources', null, {
      limit: options.limit || 50,
      offset: options.offset || 0
    }),
    get: (id) => request('GET', `/resources/${id}`),
    create: (data) => request('POST', '/resources', data),
    update: (id, data) => request('PUT', `/resources/${id}`, data),
    delete: (id) => request('DELETE', `/resources/${id}`)
  },

  // Example: users domain
  users: {
    list: () => request('GET', '/users'),
    get: (id) => request('GET', `/users/${id}`)
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
  const fn = new AsyncFunction('api', code);
  await fn(api);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
