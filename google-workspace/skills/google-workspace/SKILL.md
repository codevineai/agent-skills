---
name: google-workspace
description: Access Google Gmail, Calendar, Drive, and Contacts APIs. Use this when users need to read or search emails, manage labels and triage the inbox, read or manage calendar events, search/read Drive documents, retrieve Gemini meeting transcripts, or look up contacts.
---

# Google Workspace Skill

Access to Gmail (read + write), Google Calendar (read + manage), Google Drive (read), and Contacts (read).

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

**Custom OAuth client (optional):** To use your own GCP OAuth client instead of the built-in one, add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `~/.google-workspace/credentials` before running setup.

## Before You Start

Read the type file relevant to your task:
- **Reading email?** Read `types/gmail.d.ts`
- **Checking calendar?** Read `types/calendar.d.ts`
- **Searching/reading Drive files?** Read `types/drive.d.ts`
- **Checking contacts / known senders?** Read `types/people.d.ts`

## Usage

```bash
node ${CLAUDE_SKILL_DIR}/google_api.js <<'EOF'
// Your code here — api, gmail, calendar, drive are all available
const about = await drive.about.get();
console.log(`Logged in as: ${about.user.emailAddress}`);
EOF
```

## Quick Reference

### Find Gemini Meeting Transcripts

The typical flow: Gemini records a meeting → creates a Google Doc transcript → emails a notification.

```javascript
// Step 1: Find transcript notification emails
const result = await gmail.messages.search(
  'subject:"meeting transcript" OR subject:"transcript is ready" newer_than:7d',
  { maxResults: 5 }
);

for (const msg of result.messages) {
  const subject = msg.payload.headers.find(h => h.name === 'Subject')?.value;
  console.log(subject);
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
  const subject = msg.payload.headers.find(h => h.name === 'Subject')?.value;
  const from = msg.payload.headers.find(h => h.name === 'From')?.value;
  console.log(`${from}: ${subject}`);
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
| `calendar.events` | `list(options?)`, `get(eventId, options?)`, `search(query, options?)`, `delete(eventId, options?)` |
| `drive.files` | `list(options?)`, `get(fileId, options?)`, `getContent(fileId)`, `exportAsText(fileId, mimeType?)`, `search(name, options?)` |
| `drive.permissions` | `list(fileId)` |
| `drive.about` | `get()` |
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
