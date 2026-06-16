# Changelog

All notable changes to the `google-workspace` skill are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
