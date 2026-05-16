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

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/drive.readonly'
].join(' ');

const REDIRECT_PORT = 8089;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

async function setup() {
  const credsDir = join(homedir(), '.google-workspace');
  const credsFile = join(credsDir, 'credentials');

  // Shared OAuth client — Desktop app type, client secret is not confidential per Google's docs.
  const DEFAULT_CLIENT_ID = '797454094219-uq1uhvee4p35es9r9k8rt2ph7ac5tbsj.apps.googleusercontent.com';
  const DEFAULT_CLIENT_SECRET = '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';

  // Check for overrides in env or credentials file
  let clientId = process.env.GOOGLE_CLIENT_ID || '';
  let clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

  if (existsSync(credsFile)) {
    const content = readFileSync(credsFile, 'utf-8');
    for (const line of content.split('\n')) {
      const eq = line.indexOf('=');
      if (eq > 0) {
        const key = line.slice(0, eq).trim();
        const value = line.slice(eq + 1).trim();
        if (key === 'GOOGLE_CLIENT_ID' && !clientId) clientId = value;
        if (key === 'GOOGLE_CLIENT_SECRET' && !clientSecret) clientSecret = value;
      }
    }
  }

  // Fall back to built-in defaults
  if (!clientId) clientId = DEFAULT_CLIENT_ID;
  if (!clientSecret) clientSecret = DEFAULT_CLIENT_SECRET;

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
      console.log(`Open this URL in your browser:\n\n${authUrl.toString()}\n`);
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

  // Save credentials
  if (!existsSync(credsDir)) mkdirSync(credsDir, { recursive: true });

  // Only write client ID/secret if they differ from the built-in defaults
  let credsContent = '[default]\n';
  if (clientId !== DEFAULT_CLIENT_ID) credsContent += `GOOGLE_CLIENT_ID=${clientId}\n`;
  if (clientSecret !== DEFAULT_CLIENT_SECRET) credsContent += `GOOGLE_CLIENT_SECRET=${clientSecret}\n`;
  credsContent += `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`;

  writeFileSync(credsFile, credsContent, { mode: 0o600 });

  console.log('');
  console.log(`Credentials saved to ${credsFile}`);
  console.log('Setup complete! The Google Workspace skill is ready to use.');
}

setup().catch(err => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
