---
name: google-workspace
description: Access Google Gmail, Calendar, Drive, Docs, Sheets, Slides, Tasks, and Contacts APIs. Use this when users need to read or search emails, manage labels and triage the inbox, read or manage calendar events, search/read/write Drive files, read or edit Docs, Sheets, and Slides, manage Tasks, retrieve Gemini meeting transcripts, or look up contacts. Prefers the gws CLI when it is installed and configured.
---

# Google Workspace Skill

Access to Gmail (read + write), Google Calendar (read + manage), Google Drive (read + write), Docs, Sheets, Slides, Tasks, and Contacts (read).

Two ways to call the APIs:

| Path | Covers |
|------|--------|
| **`gws` CLI** (preferred when installed and configured) | Every Workspace API method: Gmail, Calendar, Drive read/write, Docs, Sheets, Slides, Tasks, People |
| **`google_api.js`** (always available) | Gmail, Calendar, Drive read, Sheets, Docs, Slides, Tasks, Contacts — plus the helpers gws does not have |

## Choose the path first

Run this check once per session, before the first Google call:

```bash
command -v gws >/dev/null && gws auth status 2>/dev/null | grep -E '"token_valid"|"scope_count"|"user"'
```

- **`"token_valid": true`** → gws is installed and configured. **Use gws** for every call it can make (see [Using gws](#using-gws)).
- **No output, or `token_valid` is false** → use `google_api.js` (see [Usage](#usage)). Do not install or configure gws unless the user asks.

Use `google_api.js` even when gws is available for the helpers that have no gws equivalent: `gmail.messages.search` (parsed summaries), `gmail.messages.getBody`, `gmail.messages.send` / `gmail.drafts.create` (RFC 2822 message building), `gmail.ensureLabel`, `gmail.banishSender`, `people.isKnownSender` / `people.addKnownSender`, `docs.getText`, `slides.getText`, and any non-default `GOOGLE_PROFILE`. Drive writes (upload, move, delete, share) have no `google_api.js` wrapper — those need gws.

If a gws call fails with `insufficient authentication scopes`, the gws token lacks that scope — fall back to `google_api.js` if it covers the call, otherwise tell the user to re-consent (see [Configuring gws](#configuring-gws)).

## Setup

**First time only — just run one command:**

```bash
node ${CLAUDE_SKILL_DIR}/setup.js
```

This opens your browser for Google login. Click through the consent screen (you'll see an "unverified app" warning — click Advanced → Continue). Once authorized, the script saves your refresh token to `~/.google-workspace/credentials`.

The OAuth client ID and secret are built into the skill — no GCP project setup required for end users.

**Multiple accounts:** Use `--profile` to add additional Google accounts:

```bash
node ${CLAUDE_SKILL_DIR}/setup.js --profile=personal
```

This stores credentials under a `[personal]` section in the credentials file. To use a non-default profile:

```bash
GOOGLE_PROFILE=personal node ${CLAUDE_SKILL_DIR}/google_api.js <<'EOF'
const about = await drive.about.get();
console.log(about.user.emailAddress);
EOF
```

**Scopes requested:** `gmail.modify`, `gmail.send`, `gmail.compose`, `calendar`, `drive`, `documents`, `spreadsheets`, `presentations`, `tasks`, `contacts.readonly`, `contacts.other.readonly`, `openid`, `email`, `profile`. Tokens minted before 1.5.0 have `drive.readonly` and none of the Docs/Sheets/Slides/Tasks scopes — re-run `setup.js` to re-consent.

### Configuring gws

Optional. Requires the [gws CLI](https://github.com/googleworkspace/cli) on the PATH (`brew install googleworkspace-cli` or `npm install -g @googleworkspace/cli`). After `setup.js` has saved a token, share it with gws — no browser, no second consent:

```bash
node ${CLAUDE_SKILL_DIR}/setup.js --gws
gws auth status
```

This writes `client_secret.json` and `credentials.json` to `~/.config/gws/` (or `$GOOGLE_WORKSPACE_CLI_CONFIG_DIR`) from the `[default]` profile (or `--profile`), and clears gws's token cache. It refuses to run if gws already has its own login (`credentials.enc`); run `gws auth logout` first, or keep that login and manage scopes with `gws auth login --scopes <comma-separated scopes>`.

**Custom OAuth client (optional):** To use your own GCP OAuth client instead of the built-in one, add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `~/.google-workspace/credentials` before running setup.

## Before You Start

Read the type file relevant to your task:
- **Reading email?** Read `types/gmail.d.ts`
- **Checking calendar?** Read `types/calendar.d.ts`
- **Searching/reading Drive files?** Read `types/drive.d.ts`
- **Checking contacts / known senders?** Read `types/people.d.ts`
- **Reading or writing a spreadsheet?** Read `types/sheets.d.ts`
- **Reading or editing a Google Doc?** Read `types/docs.d.ts`
- **Reading or editing a presentation?** Read `types/slides.d.ts`
- **Managing tasks?** Read `types/tasks.d.ts`

## Usage

```bash
node ${CLAUDE_SKILL_DIR}/google_api.js <<'EOF'
// Your code here — api, gmail, calendar, drive, people, sheets, docs, slides, tasks are all available
const about = await drive.about.get();
console.log(`Logged in as: ${about.user.emailAddress}`);
EOF
```

## Using gws

```bash
gws <service> <resource> [sub-resource] <method> --params '<JSON>' [--json '<JSON body>']
gws schema <service.resource.method>     # parameters, body, and required scopes for a method
```

`--params` carries URL/query parameters, `--json` the request body. Output is JSON; add `--format table|csv|yaml` to change it, `--page-all` to paginate (NDJSON, one page per line).

```bash
# Gmail
gws gmail users messages list --params '{"userId":"me","q":"is:unread newer_than:7d","maxResults":10}'
gws gmail users messages get --params '{"userId":"me","id":"MSG_ID","format":"full"}'

# Calendar
gws calendar events list --params '{"calendarId":"primary","timeMin":"2026-09-01T00:00:00Z","singleEvents":true,"orderBy":"startTime"}'
gws calendar events insert --params '{"calendarId":"primary"}' --json '{"summary":"Sync","start":{"dateTime":"2026-09-01T15:00:00","timeZone":"America/New_York"},"end":{"dateTime":"2026-09-01T15:30:00","timeZone":"America/New_York"}}'

# Drive
gws drive files list --params '{"q":"name contains \"transcript\" and trashed = false","pageSize":10,"fields":"files(id,name,mimeType,modifiedTime,webViewLink)"}'
gws drive files export --params '{"fileId":"FILE_ID","mimeType":"text/plain"}' --output transcript.txt
gws drive files create --json '{"name":"report.pdf"}' --upload ./report.pdf

# Sheets / Docs / Slides
gws sheets spreadsheets values get --params '{"spreadsheetId":"SHEET_ID","range":"Sheet1!A1:D20"}'
gws sheets spreadsheets values update --params '{"spreadsheetId":"SHEET_ID","range":"Sheet1!A1","valueInputOption":"USER_ENTERED"}' --json '{"values":[["a","b"]]}'
gws docs documents get --params '{"documentId":"DOC_ID"}'
gws slides presentations get --params '{"presentationId":"DECK_ID"}'

# Tasks / Contacts
gws tasks tasklists list
gws people people connections list --params '{"resourceName":"people/me","personFields":"names,emailAddresses","pageSize":100}'
gws people otherContacts list --params '{"readMask":"names,emailAddresses","pageSize":100}'
```

### gws gotchas

| Symptom | Cause / fix |
|---------|-------------|
| `--output ... is outside the current directory` | `--output` only accepts paths under the current directory. `cd` to the target directory first. |
| `insufficient authentication scopes` right after a re-consent | Stale `~/.config/gws/token_cache.json`; cached access tokens keep their old scopes. Delete the file and retry. |
| `API has not been used in project <other-project>` | gws took the quota project from gcloud's application-default credentials. Set `GOOGLE_WORKSPACE_PROJECT_ID` to the OAuth client's project number (the digits before the first `-` in the client ID), or make sure `client_secret.json` has `project_id`. |
| `API has not been used in project <client project>` | That API is not enabled in the OAuth client's GCP project. The error includes the enable link. |
| `No OAuth client configured` on `gws auth login` | `~/.config/gws/client_secret.json` is missing — run `setup.js --gws`. |

Send mail and create drafts through `google_api.js` — the raw Gmail API needs a base64url RFC 2822 message, which the skill builds for you.

## Quick Reference

The examples below use `google_api.js`.

### Find Gemini Meeting Transcripts

The typical flow: Gemini records a meeting → creates a Google Doc transcript → emails a notification.

```javascript
// Step 1: Find transcript notification emails
const result = await gmail.messages.search(
  'subject:"meeting transcript" OR subject:"transcript is ready" newer_than:7d',
  { maxResults: 5 }
);

for (const msg of result.messages) {
  console.log(msg.subject);
}

// Step 2: Get the full email to find the Drive link
const msg = await gmail.messages.getBody(result.messages[0].id);
console.log(msg.text); // Contains Drive doc links

// Step 3: If you have a Drive file ID, read the transcript
// Extract file ID from a Google Docs URL: https://docs.google.com/document/d/FILE_ID/edit
const transcript = await drive.files.exportAsText('FILE_ID_HERE');
console.log(transcript);
```

### Search Drive for Transcripts Directly

```javascript
const result = await drive.files.search('transcript', {
  mimeType: 'application/vnd.google-apps.document'
});
for (const f of result.files) {
  console.log(`${f.name} — ${f.modifiedTime} — ${f.webViewLink}`);
}
```

### Read Recent Emails

```javascript
const result = await gmail.messages.search('is:unread', { maxResults: 5 });
for (const msg of result.messages) {
  console.log(`${msg.from}: ${msg.subject}`);
}
```

### Get Today's Calendar

```javascript
const now = new Date();
const endOfDay = new Date(now);
endOfDay.setHours(23, 59, 59);
const result = await calendar.events.list({
  timeMin: now.toISOString(),
  timeMax: endOfDay.toISOString()
});
for (const event of result.items) {
  const time = event.start.dateTime
    ? new Date(event.start.dateTime).toLocaleTimeString()
    : 'All day';
  console.log(`${time}: ${event.summary}`);
}
```

### Check Calendar Events for Attachments (Transcripts)

```javascript
// Events from last 7 days that may have transcript attachments
const weekAgo = new Date(Date.now() - 7 * 86400000);
const result = await calendar.events.list({
  timeMin: weekAgo.toISOString(),
  timeMax: new Date().toISOString()
});
for (const event of result.items) {
  if (event.attachments?.length) {
    console.log(`${event.summary}:`);
    for (const att of event.attachments) {
      console.log(`  ${att.title} — ${att.fileUrl}`);
    }
  }
}
```

### Create Calendar Events

Requires the write scope (`auth/calendar`). If a create call fails with a 403 about
insufficient scopes, re-run `setup.js` to re-consent.

```javascript
// start/end use { dateTime, timeZone } for timed events, or { date } for all-day.
// Pass the IANA timeZone so DST offsets are computed correctly.
const ev = await calendar.events.create({
  summary: 'ReadSource Committee',
  location: 'Schenck School',
  description: 'Board of Trustees 2026-27 — ReadSource Committee.',
  start: { dateTime: '2026-08-19T08:30:00', timeZone: 'America/New_York' },
  end:   { dateTime: '2026-08-19T09:30:00', timeZone: 'America/New_York' },
});
console.log(`Created: ${ev.htmlLink}`);

// Invite attendees and send email invitations:
await calendar.events.create({
  summary: 'Sync',
  start: { dateTime: '2026-09-01T15:00:00', timeZone: 'America/New_York' },
  end:   { dateTime: '2026-09-01T15:30:00', timeZone: 'America/New_York' },
  attendees: [{ email: 'someone@example.com' }],
}, { sendUpdates: 'all' });

// Patch a single field, or delete:
await calendar.events.patch(ev.id, { location: 'Virtual' });
await calendar.events.delete(ev.id);
```

### Read and Write a Spreadsheet

IDs come from the URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit` (same pattern for `/document/d/` and `/presentation/d/`).

```javascript
const id = 'SPREADSHEET_ID';
const { values = [] } = await sheets.values.get(id, 'Sheet1!A1:D20');
for (const row of values) console.log(row.join(' | '));

// Overwrite from A1; formulas and numbers are parsed as if typed
await sheets.values.update(id, 'Sheet1!A1', [['name', 'qty'], ['widgets', 12], ['total', '=SUM(B2:B2)']]);

// Add rows after the last row of the table
await sheets.values.append(id, 'Sheet1!A1', [['gadgets', 7]]);

// New spreadsheet
const ss = await sheets.spreadsheets.create({ title: 'Q3 Forecast', sheets: ['Data', 'Summary'] });
console.log(ss.spreadsheetUrl);
```

### Read and Edit a Google Doc

```javascript
const text = await docs.getText('DOCUMENT_ID');   // all tabs, tables tab-separated
console.log(text);

await docs.appendText('DOCUMENT_ID', 'Action items\n- Send the report\n');
const n = await docs.replaceText('DOCUMENT_ID', '{{client}}', 'Acme Corp');   // returns count

const doc = await docs.documents.create({ title: 'Meeting notes' });
```

Formatting, tables, and images go through `docs.documents.batchUpdate(id, requests)`.

### Read and Edit a Presentation

```javascript
for (const s of await slides.getText('PRESENTATION_ID')) {
  console.log(`--- Slide ${s.index}\n${s.text}`);
  if (s.notes.trim()) console.log(`Notes: ${s.notes}`);
}

const slideId = await slides.addSlide('PRESENTATION_ID', { layout: 'TITLE_AND_BODY' });
await slides.replaceText('PRESENTATION_ID', '{{date}}', 'Sept 27, 2026');
```

Native Google Slides only — an uploaded `.pptx` is a Drive file, not a presentation.

### Manage Tasks

```javascript
// Open tasks in the primary list
const { items = [] } = await tasks.tasks.list({ showCompleted: false });
for (const t of items) console.log(`${t.due?.slice(0, 10) || 'no date'}  ${t.title}`);

const t = await tasks.tasks.create({ title: 'Send invoice', notes: 'Acme, September', due: '2026-10-05T00:00:00.000Z' });
await tasks.tasks.complete(t.id);

// Another list: pass tasklistId
const { items: lists } = await tasks.tasklists.list();
await tasks.tasks.create({ title: 'Book flights' }, { tasklistId: lists[1].id });
```

## API Summary

| API | Methods |
|-----|---------|
| `gmail.messages` | `list(options?)`, `get(id, options?)`, `getBody(id)`, `search(query, options?)`, `getAttachment(messageId, attachmentId)`, `modify(id, options)`, `batchModify(options)`, `trash(id)`, `batchDelete(ids)`, `send(options)` |
| `gmail.drafts` | `list(options?)`, `get(id, options?)`, `create(options)`, `send(id)`, `delete(id)` |
| `gmail.labels` | `list()`, `get(id)` |
| `gmail.threads` | `list(options?)`, `get(id, options?)` |
| `gmail` | `ensureLabel(name)`, `banishSender(emailOrDomain)` |

Sending and drafting use compose options: `{ to, cc, bcc, from, replyTo, subject, body, html, threadId, inReplyTo, references }`. Provide `body` for plain text or `html` for HTML. `to`/`cc`/`bcc` accept a string or array.

```bash
node ${CLAUDE_SKILL_DIR}/google_api.js <<'EOF'
await gmail.messages.send({ to: 'someone@example.com', subject: 'Hello', body: 'Sent from the skill.' });
EOF
```

If a send/draft call fails with a 403 about insufficient scopes, the refresh token predates the send capability — re-run `node ${CLAUDE_SKILL_DIR}/setup.js` to re-consent.
| `calendar.calendars` | `list()`, `get(calendarId?)` |
| `calendar.events` | `list(options?)`, `get(eventId, options?)`, `search(query, options?)`, `create(event, options?)`, `update(eventId, event, options?)`, `patch(eventId, fields, options?)`, `delete(eventId, options?)`, `move(eventId, destCalendarId, options?)`, `quickAdd(text, options?)` |
| `drive.files` (read-only wrappers; write via gws) | `list(options?)`, `get(fileId, options?)`, `getContent(fileId)`, `exportAsText(fileId, mimeType?)`, `search(name, options?)` |
| `drive.permissions` | `list(fileId)` |
| `drive.about` | `get()` |
| `sheets.spreadsheets` | `get(id, options?)`, `create(options?)`, `batchUpdate(id, requests, options?)` |
| `sheets.values` | `get(id, range, options?)`, `batchGet(id, ranges, options?)`, `update(id, range, values, options?)`, `append(id, range, values, options?)`, `clear(id, range)`, `batchUpdate(id, data, options?)` |
| `sheets` | `addSheet(id, title, options?)`, `deleteSheet(id, sheetId)` |
| `docs.documents` | `get(id, options?)`, `create(options?)`, `batchUpdate(id, requests, options?)` |
| `docs` | `getText(id, options?)`, `appendText(id, text, options?)`, `insertText(id, text, index, options?)`, `replaceText(id, find, replacement, options?)` |
| `slides.presentations` | `get(id, options?)`, `create(options?)`, `batchUpdate(id, requests, options?)` |
| `slides.pages` | `get(id, pageId)`, `getThumbnail(id, pageId, options?)` |
| `slides` | `getText(id)`, `addSlide(id, options?)`, `replaceText(id, find, replacement, options?)` |
| `tasks.tasklists` | `list(options?)`, `get(tasklistId?)`, `create(options)`, `patch(tasklistId, fields)`, `delete(tasklistId)` |
| `tasks.tasks` | `list(options?)`, `get(taskId, options?)`, `create(task, options?)`, `patch(taskId, fields, options?)`, `update(taskId, task, options?)`, `delete(taskId, options?)`, `complete(taskId, options?)`, `reopen(taskId, options?)`, `move(taskId, options?)`, `clearCompleted(options?)` |
| `people.connections` | `list(options?)` |
| `people.otherContacts` | `list(options?)`, `search(query, options?)` |
| `people` | `isKnownSender(email)`, `addKnownSender(email)` |

## Gmail Search Query Tips

These work in `gmail.messages.search()` and `gmail.messages.list({ query })`:

| Query | Description |
|-------|-------------|
| `from:user@example.com` | From specific sender |
| `subject:transcript` | Subject contains word |
| `has:attachment` | Has any attachment |
| `has:drive` | Has Drive attachment |
| `newer_than:7d` | Last 7 days |
| `after:2024/01/15` | After specific date |
| `is:unread` | Unread messages |
| `label:INBOX` | In inbox |

## Drive Query Tips

These work in `drive.files.list({ query })`:

| Query | Description |
|-------|-------------|
| `name contains 'transcript'` | Name contains word |
| `mimeType = 'application/vnd.google-apps.document'` | Google Docs only |
| `modifiedTime > '2024-01-01'` | Modified after date |
| `'FOLDER_ID' in parents` | In specific folder |
| `trashed = false` | Not in trash |
