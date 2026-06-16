/**
 * Google People API Types
 *
 * Access Google Contacts, "Other Contacts" (auto-collected from email interactions),
 * and a unified known-senders cache with incremental sync.
 *
 * The known-senders system combines three sources:
 *   1. Google Contacts (people you explicitly saved)
 *   2. Other Contacts (people Google auto-collected from your email interactions)
 *   3. Manual whitelist (addresses you've explicitly added via addKnownSender)
 *
 * The cache is stored at ~/.google-workspace/contacts-cache.json and syncs
 * incrementally using Google's sync tokens. Manual entries are never overwritten by sync.
 */

// ============================================================================
// RESPONSE TYPES
// ============================================================================

interface PersonEmailAddress {
  value: string;
  type?: string;
  formattedType?: string;
}

interface PersonName {
  displayName?: string;
  givenName?: string;
  familyName?: string;
}

interface PersonMetadata {
  deleted?: boolean;
  sources?: Array<{ type: string; id: string }>;
}

interface Person {
  resourceName: string;
  etag?: string;
  metadata?: PersonMetadata;
  names?: PersonName[];
  emailAddresses?: PersonEmailAddress[];
}

// ============================================================================
// RESULT TYPES
// ============================================================================

interface ConnectionsListResult {
  connections: Person[];
}

interface OtherContactsListResult {
  otherContacts: Person[];
}

interface OtherContactsSearchResult {
  results: Array<{ person: Person }>;
}

// ============================================================================
// API INTERFACE
// ============================================================================

interface PeopleConnectionsAPI {
  /**
   * List all saved Google Contacts. Auto-paginates through all results.
   *
   * @example
   * const result = await people.connections.list();
   * for (const person of result.connections) {
   *   const name = person.names?.[0]?.displayName || 'Unknown';
   *   const email = person.emailAddresses?.[0]?.value || 'No email';
   *   console.log(`${name}: ${email}`);
   * }
   */
  list(options?: {
    personFields?: string;
    pageSize?: number;
    singlePage?: boolean;
  }): Promise<ConnectionsListResult>;
}

interface PeopleOtherContactsAPI {
  /**
   * List "Other Contacts" — people auto-collected from email interactions
   * who are not in your explicit contacts. Auto-paginates through all results.
   *
   * @example
   * const result = await people.otherContacts.list();
   * for (const person of result.otherContacts) {
   *   const email = person.emailAddresses?.[0]?.value;
   *   if (email) console.log(email);
   * }
   */
  list(options?: {
    readMask?: string;
    pageSize?: number;
    singlePage?: boolean;
  }): Promise<OtherContactsListResult>;

  /**
   * Search other contacts by name or email prefix (mimics Gmail autocomplete).
   *
   * @example
   * const result = await people.otherContacts.search('john');
   */
  search(query: string, options?: {
    readMask?: string;
    pageSize?: number;
  }): Promise<OtherContactsSearchResult>;
}

interface PeopleAPI {
  connections: PeopleConnectionsAPI;
  otherContacts: PeopleOtherContactsAPI;

  /**
   * Check if an email address belongs to a known sender.
   *
   * Known senders include: Google Contacts, Other Contacts (auto-collected
   * from email interactions), and manually whitelisted addresses.
   *
   * On first call per script run, this lazy-loads the local cache and performs
   * an incremental sync with Google (fast — only fetches changes since last sync).
   * Subsequent calls return instantly from the in-memory Set.
   *
   * If the sync token has expired (410 GONE), automatically falls back to a
   * full re-sync without losing any existing or manual entries.
   *
   * @param email - The email address to check (case-insensitive)
   * @returns true if the sender is known
   *
   * @example
   * // Check if a sender is known before flagging as spam
   * const fromEmail = 'someone@example.com';
   * if (await people.isKnownSender(fromEmail)) {
   *   console.log('Known sender — skip spam filtering');
   * } else {
   *   console.log('Unknown sender — check for cold outreach patterns');
   * }
   *
   * @example
   * // Filter inbox for unknown senders
   * const result = await gmail.messages.search('in:inbox', { maxResults: 50 });
   * for (const msg of result.messages) {
   *   const email = (msg.from.match(/[\w.+-]+@[\w.-]+\.\w+/i) || [''])[0];
   *   if (email && !(await people.isKnownSender(email))) {
   *     console.log(`Unknown sender: ${from}`);
   *   }
   * }
   */
  isKnownSender(email: string): Promise<boolean>;

  /**
   * Add an email address to the known senders whitelist.
   *
   * This adds the address to the manual whitelist in the local cache
   * (~/.google-workspace/contacts-cache.json). Manual entries are never
   * overwritten by Google sync — they persist across full re-syncs.
   *
   * Use this when a user instructs you to whitelist an address that isn't
   * in their Google Contacts or Other Contacts.
   *
   * @param email - The email address to whitelist (case-insensitive)
   *
   * @example
   * // User says "don't filter emails from billing@acme.com"
   * await people.addKnownSender('billing@acme.com');
   * console.log('Added to known senders whitelist');
   *
   * @example
   * // Whitelist during interactive triage
   * const email = 'newsletter@substack.com';
   * await people.addKnownSender(email);
   * console.log(await people.isKnownSender(email)); // true
   */
  addKnownSender(email: string): Promise<void>;
}
