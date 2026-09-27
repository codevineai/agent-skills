# Changelog

All notable changes to the `google-workspace` skill are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.5.0]

### Added
- **gws CLI support.** `SKILL.md` now tells the agent to check for an installed, configured [gws CLI](https://github.com/googleworkspace/cli) (`gws auth status` → `token_valid: true`) and prefer it for API calls, falling back to `google_api.js` when gws is absent or unconfigured. `google_api.js` stays the path for its helpers (search summaries, `getBody`, send/drafts, `ensureLabel`, `banishSender`, known senders) and for non-default profiles. New "Using gws" section with command examples and a gotchas table.
- **`setup.js --gws`** shares the saved OAuth client and refresh token with gws: writes `client_secret.json` and `credentials.json` to the gws config dir (`~/.config/gws` or `$GOOGLE_WORKSPACE_CLI_CONFIG_DIR`) and clears gws's token cache. No browser flow. Honors `--profile`. Refuses to run when gws already has its own login (`credentials.enc`).

### Changed
- **OAuth scopes broadened.** `drive.readonly` → `drive` (read + write); added `documents`, `spreadsheets`, `presentations`, `tasks`, `openid`, `email`, `profile`.

### Migration notes
- Existing tokens keep working for everything they could do before. Re-run `setup.js` to re-consent and pick up the new scopes, then `setup.js --gws` again if gws shares the token.
- The Sheets, Docs, Slides, and Tasks APIs must be enabled in the OAuth client's GCP project.
- `google_api.js` is unchanged: it has no Drive write, Docs, Sheets, Slides, or Tasks wrappers. Those go through gws.

## [1.4.0]

### Added
- **Calendar event write operations:** `calendar.events.create(event, options?)`, `update(eventId, event, options?)` (full replace), `patch(eventId, fields, options?)` (partial), `move(eventId, destCalendarId, options?)`, and `quickAdd(text, options?)`. `create`/`update`/`patch` accept a Calendar Event resource (`summary`, `location`, `description`, `start`/`end` as `{ dateTime, timeZone }` or `{ date }`, `attendees`, `recurrence`, `reminders`, `attachments`, …). Write options: `calendarId`, `sendUpdates` (`all`/`externalOnly`/`none`), and `conferenceData` (set true to create a Meet link from a `conferenceData.createRequest` body).
- **`delete` now forwards `sendUpdates`** so cancellations can notify attendees.
- `types/calendar.d.ts` gains `CalendarEventInput`, `EventDateTime`, and `CalendarWriteOptions`, and documents create/update/patch/delete/move/quickAdd. `SKILL.md` adds a "Create Calendar Events" section and expands the `calendar.events` method table.

### Migration notes
- Backward-compatible and no re-auth needed: the `calendar` (read+write) scope was already granted in 1.1.0, so tokens minted at 1.1.0 or later can create/update/delete immediately. Read-only calls are unchanged.

## [1.3.0]

### Fixed
- **`messages.search` returned headerless results.** The per-message fetch built the repeated `metadataHeaders` query param as a single joined string, which got URL-encoded into one invalid value — so Gmail returned messages whose `payload.headers` was empty and `msg.payload.headers.find(...)` threw `Cannot read properties of undefined`. The param is now passed as an array and emitted correctly.

### Changed
- **`messages.search` now returns parsed summaries.** Each result has `subject`, `from`, `to`, `date`, and `snippet` lifted to the top level (`msg.subject` instead of `msg.payload.headers.find(...)`). The raw `payload` is still present for power users, and body text is unchanged — use `getBody(id)` for that. New `GmailMessageSummary` type documents the shape; `search` docstrings and examples updated.

### Migration notes
- Backward-compatible: `payload` remains on each search row (its `headers` are now correctly populated), so existing `payload.headers` code keeps working — but the top-level `msg.subject`/`msg.from` fields are the recommended path.

## [1.2.0]

### Added
- **Send email:** `gmail.messages.send(options)` builds an RFC 2822 message and sends it immediately. Supports `to`/`cc`/`bcc` (string or array), `from`, `replyTo`, `subject`, plain-text `body` or `html`, and threading via `threadId`/`inReplyTo`/`references`.
- **Drafts:** new `gmail.drafts` namespace — `list`, `get`, `create(options)`, `send(id)`, and `delete(id)`. `create` uses the same compose options as `messages.send`.
- Non-ASCII subjects are RFC 2047 encoded; bodies are base64url-encoded per Gmail's API.

### Changed
- **OAuth scopes broadened** to add `gmail.send` and `gmail.compose`.
- The HTTP client now detects 401/403 responses mentioning insufficient scopes/permission and appends a hint to re-run `setup.js` to re-consent.

### Migration notes
- **Re-authentication required to send or draft.** Tokens minted before 1.2.0 lack the `gmail.send`/`gmail.compose` scopes; send/draft calls will fail with a 403 and the error now suggests re-running `setup.js`. All other operations continue to work unchanged.

## [1.1.0]

### Added
- **Gmail write operations:** `messages.modify`, `messages.batchModify`, `messages.trash`, and `messages.batchDelete` for changing labels, trashing, and permanently deleting messages.
- **Label management:** `gmail.ensureLabel(name)` gets or creates a label by name (cached per run) and returns its ID.
- **Inbox triage helper:** `gmail.banishSender(emailOrDomain)` appends a sender or `*@domain` pattern to the Banished Senders section of `~/.google-workspace/inbox-rules.md`.
- **Calendar write:** `calendar.events.delete(eventId)`.
- **Google People (Contacts) API:** new `people` namespace — `people.connections.list`, `people.otherContacts.list`, `people.otherContacts.search`, plus a synced known-senders cache via `people.isKnownSender(email)` and `people.addKnownSender(email)` (incremental sync tokens persisted to `~/.google-workspace/contacts-cache.json`).
- **Multiple Google accounts:** `setup.js --profile=<name>` writes credentials to a named INI section; select a profile at runtime with `GOOGLE_PROFILE=<name>`. The `default` profile is used as a fallback.
- **`types/people.d.ts`** documenting the People API surface.

### Changed
- **OAuth scopes broadened** to enable the new features: `gmail.modify`, `calendar` (read+write), `contacts.readonly`, and `contacts.other.readonly` (Drive remains `drive.readonly`).
- `setup.js` now opens the authorization URL in the browser automatically and preserves other profiles when re-running for one profile.
- Type tables and method reference in `SKILL.md` updated to cover the new operations.

### Migration notes
- **Re-authentication required for the new features.** Tokens minted under the 1.0.0 read-only scopes (`gmail.readonly`, `calendar.readonly`, `drive.readonly`) cannot perform the new write or contacts operations. Re-run `setup.js` to re-consent and obtain a token with the broader scopes. All existing read operations continue to work unchanged.

## [1.0.0]

### Added
- Initial release: read-only access to Gmail, Google Calendar, and Google Drive.
- Gmail: list/get/search messages, fetch bodies and attachments, list labels.
- Calendar: list/get/search events.
- Drive: list/search/read documents, retrieve Gemini meeting transcripts.
- INI credentials file at `~/.google-workspace/credentials` with a single `default` profile; `setup.js` OAuth flow with read-only scopes.
- Type definitions for Gmail, Calendar, and Drive.
