/**
 * Gmail API Types
 *
 * Access Gmail messages, threads, and labels.
 * All operations are read-only (gmail.readonly scope).
 */

// ============================================================================
// RESPONSE TYPES
// ============================================================================

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessagePart {
  partId: string;
  mimeType: string;
  filename: string;
  headers: GmailHeader[];
  body: {
    attachmentId?: string;
    size: number;
    data?: string; // base64url encoded
  };
  parts?: GmailMessagePart[];
}

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  /** Size in bytes */
  sizeEstimate: number;
  /** Unix timestamp in ms */
  internalDate: string;
  payload: GmailMessagePart;
}

/** Parsed message body returned by gmail.messages.getBody() */
interface GmailParsedMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  /** Plain text body */
  text: string;
  /** HTML body */
  html: string;
  /** List of attachments on the message */
  attachments: GmailAttachmentInfo[];
  snippet: string;
  labelIds: string[];
}

interface GmailAttachmentInfo {
  filename: string;
  mimeType: string;
  size: number;
  /** Use with gmail.messages.getAttachment(messageId, attachmentId) */
  attachmentId: string;
}

interface GmailAttachment {
  /** base64url encoded attachment data */
  data: string;
  size: number;
}

interface GmailLabel {
  id: string;
  name: string;
  type: 'system' | 'user';
  messageListVisibility?: 'show' | 'hide';
  labelListVisibility?: 'labelShow' | 'labelShowIfUnread' | 'labelHide';
  messagesTotal?: number;
  messagesUnread?: number;
  threadsTotal?: number;
  threadsUnread?: number;
}

interface GmailThread {
  id: string;
  snippet: string;
  messages?: GmailMessage[];
}

// ============================================================================
// OPTION TYPES
// ============================================================================

interface GmailMessageListOptions {
  /** Gmail search query (same syntax as Gmail search box) */
  query?: string;
  /** Max results (default: 20) */
  maxResults?: number;
  /** Page token for pagination */
  pageToken?: string;
  /** Filter by label IDs */
  labelIds?: string[];
}

interface GmailSearchOptions {
  /** Max results (default: 10) */
  maxResults?: number;
  /** Page token for pagination */
  pageToken?: string;
  /** Response format: 'metadata' (default, faster) or 'full' */
  format?: 'metadata' | 'full';
  /** Headers to include in metadata format */
  metadataHeaders?: string[];
}

// ============================================================================
// RESULT TYPES
// ============================================================================

interface GmailMessageListResult {
  messages: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate: number;
}

interface GmailSearchResult {
  messages: GmailMessage[];
  nextPageToken?: string;
  resultSizeEstimate: number;
}

interface GmailLabelListResult {
  labels: GmailLabel[];
}

interface GmailThreadListResult {
  threads: Array<{ id: string; snippet: string }>;
  nextPageToken?: string;
  resultSizeEstimate: number;
}

// ============================================================================
// API INTERFACE
// ============================================================================

interface GmailMessagesAPI {
  /**
   * List message IDs (lightweight — returns stubs, not full messages)
   *
   * @example
   * const result = await gmail.messages.list({ query: 'is:unread', maxResults: 5 });
   * for (const msg of result.messages) {
   *   console.log(msg.id);
   * }
   */
  list(options?: GmailMessageListOptions): Promise<GmailMessageListResult>;

  /**
   * Get a full message by ID (raw Gmail format with payload parts)
   *
   * @example
   * const msg = await gmail.messages.get('msg_id_here');
   * const subject = msg.payload.headers.find(h => h.name === 'Subject')?.value;
   */
  get(id: string, options?: { format?: 'full' | 'metadata' | 'minimal' }): Promise<GmailMessage>;

  /**
   * Get a message with parsed body (subject, from, to, text, html, attachments)
   * This is the most useful method for reading email content.
   *
   * @example
   * const msg = await gmail.messages.getBody('msg_id_here');
   * console.log(`From: ${msg.from}`);
   * console.log(`Subject: ${msg.subject}`);
   * console.log(msg.text);
   * console.log(`Attachments: ${msg.attachments.map(a => a.filename).join(', ')}`);
   */
  getBody(id: string): Promise<GmailParsedMessage>;

  /**
   * Search emails and return message details (combines list + get)
   * Uses Gmail search query syntax.
   *
   * @example
   * // Find Gemini meeting transcript emails
   * const result = await gmail.messages.search('from:calendar-notification@google.com subject:transcript');
   * for (const msg of result.messages) {
   *   const subject = msg.payload.headers.find(h => h.name === 'Subject')?.value;
   *   console.log(subject);
   * }
   *
   * @example
   * // Find emails with Drive attachments from last 7 days
   * const result = await gmail.messages.search('has:drive newer_than:7d');
   */
  search(query: string, options?: GmailSearchOptions): Promise<GmailSearchResult>;

  /**
   * Get attachment data (base64url encoded)
   *
   * @example
   * const msg = await gmail.messages.getBody('msg_id');
   * for (const att of msg.attachments) {
   *   const data = await gmail.messages.getAttachment('msg_id', att.attachmentId);
   *   console.log(`${att.filename}: ${data.size} bytes`);
   * }
   */
  getAttachment(messageId: string, attachmentId: string): Promise<GmailAttachment>;
}

interface GmailLabelsAPI {
  /**
   * List all labels
   *
   * @example
   * const result = await gmail.labels.list();
   * for (const label of result.labels) {
   *   console.log(`${label.name} (${label.messagesUnread} unread)`);
   * }
   */
  list(): Promise<GmailLabelListResult>;

  /**
   * Get label details
   */
  get(id: string): Promise<GmailLabel>;
}

interface GmailThreadsAPI {
  /**
   * List threads (conversations)
   *
   * @example
   * const result = await gmail.threads.list({ query: 'subject:standup', maxResults: 5 });
   */
  list(options?: GmailMessageListOptions): Promise<GmailThreadListResult>;

  /**
   * Get a full thread with all messages
   *
   * @example
   * const thread = await gmail.threads.get('thread_id');
   * for (const msg of thread.messages) {
   *   console.log(msg.snippet);
   * }
   */
  get(id: string, options?: { format?: 'full' | 'metadata' | 'minimal' }): Promise<GmailThread>;
}

// ============================================================================
// GMAIL WRITE OPERATIONS
// ============================================================================

interface GmailModifyOptions {
  addLabelIds?: string[];
  removeLabelIds?: string[];
}

interface GmailBatchModifyOptions {
  ids: string[];
  addLabelIds?: string[];
  removeLabelIds?: string[];
}

/**
 * Options for composing an outgoing message (send or draft).
 * Provide either `body` (plain text) or `html` (HTML). If both are given, `html` wins.
 */
interface GmailComposeOptions {
  /** Recipient(s) — a single address or an array */
  to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  /** Override the From header (defaults to the authenticated account) */
  from?: string;
  replyTo?: string | string[];
  subject?: string;
  /** Plain-text body */
  body?: string;
  /** HTML body (takes precedence over `body`) */
  html?: string;
  /** Thread to attach the message to (for replies) */
  threadId?: string;
  /** Message-ID being replied to (sets the In-Reply-To header) */
  inReplyTo?: string;
  /** References header value (for threading) */
  references?: string;
}

interface GmailAPI {
  messages: GmailMessagesAPI & {
    /** Modify labels on a message (add/remove labels) */
    modify(id: string, options: GmailModifyOptions): Promise<any>;
    /** Modify labels on multiple messages at once (max 1000 per call) */
    batchModify(options: GmailBatchModifyOptions): Promise<any>;
    /** Move a message to trash */
    trash(id: string): Promise<any>;
    /** Permanently delete messages (cannot be undone!) */
    batchDelete(ids: string[]): Promise<any>;
    /**
     * Send an email immediately. Requires the gmail.send scope.
     *
     * @example
     * await gmail.messages.send({ to: 'a@b.com', subject: 'Hi', body: 'Hello there' });
     * // reply within a thread:
     * await gmail.messages.send({ to: 'a@b.com', subject: 'Re: Hi', body: '...', threadId, inReplyTo: '<msgid>' });
     */
    send(options: GmailComposeOptions): Promise<{ id: string; threadId: string; labelIds?: string[] }>;
  };

  /** Draft management. Creating/sending drafts requires the gmail.compose scope. */
  drafts: {
    /** List drafts (id + message stub) */
    list(options?: { maxResults?: number; pageToken?: string }): Promise<any>;
    /** Get a single draft */
    get(id: string, options?: { format?: 'full' | 'metadata' | 'minimal' }): Promise<any>;
    /** Create a draft from compose options */
    create(options: GmailComposeOptions): Promise<{ id: string; message: { id: string; threadId: string } }>;
    /** Send an existing draft by ID */
    send(id: string): Promise<{ id: string; threadId: string; labelIds?: string[] }>;
    /** Delete a draft */
    delete(id: string): Promise<any>;
  };

  labels: GmailLabelsAPI;
  threads: GmailThreadsAPI;

  /**
   * Get or create a Gmail label by name. Returns the label ID.
   * Caches label lookups for the lifetime of the script.
   *
   * @param labelName - The label name (e.g., "Jira", "Notifications", "AI Detected Spam")
   * @returns The label ID string
   *
   * @example
   * const labelId = await gmail.ensureLabel('Notifications');
   * await gmail.messages.modify(msgId, { addLabelIds: [labelId], removeLabelIds: ['INBOX'] });
   */
  ensureLabel(labelName: string): Promise<string>;

  /**
   * Add a sender email or *@domain pattern to the permanent banished list
   * in ~/.google-workspace/inbox-rules.md. Entries in this list should be
   * treated as permanently blocked by any inbox processing workflow.
   *
   * @param emailOrDomain - Exact email or wildcard domain (e.g., "*@spamdomain.com")
   *
   * @example
   * await gmail.banishSender('spammer@coldoutreach.io');
   * await gmail.banishSender('*@coldoutreach.io'); // block entire domain
   */
  banishSender(emailOrDomain: string): Promise<void>;
}
