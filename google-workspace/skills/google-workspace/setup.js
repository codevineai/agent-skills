#!/usr/bin/env node
/**
 * Google Workspace Skill - OAuth Setup
 *
 * Run this once to get a refresh token:
 *   node ${CLAUDE_SKILL_DIR}/setup.js
 *
 * Prerequisites:
 *   1. Create OAuth 2.0 Client ID at https://console.cloud.google.com/apis/credentials
 *      - Application type: "Desktop app"
 *   2. Enable these APIs in your GCP project:
 *      - Gmail API
 *      - Google Calendar API
 *      - Google Drive API
 */

import { createServer } from 'http';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { URL } from 'url';
import { exec } from 'child_process';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/contacts.other.readonly'
].join(' ');

const REDIRECT_PORT = 8089;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

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

function serializeIniFile(profiles) {
  const sections = [];
  // Write [default] first if it exists
  if (profiles['default']) {
    sections.push(serializeSection('default', profiles['default']));
  }
  for (const [name, data] of Object.entries(profiles)) {
    if (name === 'default') continue;
    sections.push(serializeSection(name, data));
  }
  return sections.join('\n');
}

function serializeSection(name, data) {
  let out = `[${name}]\n`;
  for (const [key, value] of Object.entries(data)) {
    out += `${key}=${value}\n`;
  }
  return out;
}

async function setup() {
  const credsDir = join(homedir(), '.google-workspace');
  const credsFile = join(credsDir, 'credentials');

  // Parse --profile argument
  const profileArg = process.argv.find(a => a.startsWith('--profile='));
  const profileIdx = process.argv.indexOf('--profile');
  const profileName = profileArg ? profileArg.split('=')[1] : (profileIdx >= 0 ? process.argv[profileIdx + 1] : 'default');

  // Shared OAuth client — Desktop app type, client secret is not confidential per Google's docs.
  const DEFAULT_CLIENT_ID = '797454094219-uq1uhvee4p35es9r9k8rt2ph7ac5tbsj.apps.googleusercontent.com';
  const DEFAULT_CLIENT_SECRET = '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';

  // Load existing profiles so we don't overwrite them
  let profiles = {};
  if (existsSync(credsFile)) {
    const content = readFileSync(credsFile, 'utf-8');
    profiles = parseIniFile(content);
  }

  // Check for overrides in env or existing profile credentials
  let clientId = process.env.GOOGLE_CLIENT_ID || '';
  let clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

  const existingProfile = profiles[profileName] || {};
  if (!clientId && existingProfile.GOOGLE_CLIENT_ID) clientId = existingProfile.GOOGLE_CLIENT_ID;
  if (!clientSecret && existingProfile.GOOGLE_CLIENT_SECRET) clientSecret = existingProfile.GOOGLE_CLIENT_SECRET;

  // Fall back to built-in defaults
  if (!clientId) clientId = DEFAULT_CLIENT_ID;
  if (!clientSecret) clientSecret = DEFAULT_CLIENT_SECRET;

  console.log(`Setting up profile: ${profileName}`);
  console.log('Starting OAuth flow...');
  console.log('');

  // Build auth URL
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  // Start local server to catch the callback
  const code = await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);

      if (url.pathname === '/callback') {
        const authCode = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`<h1>Error: ${error}</h1><p>You can close this tab.</p>`);
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Success!</h1><p>You can close this tab and return to the terminal.</p>');
        server.close();
        resolve(authCode);
      }
    });

    server.listen(REDIRECT_PORT, () => {
      const url = authUrl.toString();
      console.log(`Opening browser for authorization...\n\n${url}\n`);
      // Open browser automatically — macOS: open, Linux: xdg-open, Windows: start
      const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${cmd} "${url}"`);
      console.log('Waiting for authorization...');
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Timed out waiting for authorization'));
    }, 300000);
  });

  // Exchange code for tokens
  console.log('Exchanging authorization code for tokens...');

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI
    })
  });

  if (!tokenResponse.ok) {
    const text = await tokenResponse.text();
    throw new Error(`Token exchange failed: ${text}`);
  }

  const tokens = await tokenResponse.json();

  if (!tokens.refresh_token) {
    throw new Error('No refresh token received. Try revoking access at https://myaccount.google.com/permissions and running setup again.');
  }

  // Save credentials — update only the target profile, preserve others
  if (!existsSync(credsDir)) mkdirSync(credsDir, { recursive: true });

  const newProfileData = {};
  if (clientId !== DEFAULT_CLIENT_ID) newProfileData.GOOGLE_CLIENT_ID = clientId;
  if (clientSecret !== DEFAULT_CLIENT_SECRET) newProfileData.GOOGLE_CLIENT_SECRET = clientSecret;
  newProfileData.GOOGLE_REFRESH_TOKEN = tokens.refresh_token;

  profiles[profileName] = newProfileData;

  writeFileSync(credsFile, serializeIniFile(profiles), { mode: 0o600 });

  console.log('');
  console.log(`Credentials saved to ${credsFile} [${profileName}]`);
  console.log('Setup complete! The Google Workspace skill is ready to use.');
  if (profileName !== 'default') {
    console.log(`\nTo use this profile, set: export GOOGLE_PROFILE=${profileName}`);
  }
}

setup().catch(err => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
