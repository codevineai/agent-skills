/**
 * Google Calendar API Types
 *
 * Access calendars and events. Read-only (calendar.readonly scope).
 */

// ============================================================================
// RESPONSE TYPES
// ============================================================================

interface CalendarEntry {
  id: string;
  summary: string;
  description?: string;
  timeZone: string;
  backgroundColor?: string;
  foregroundColor?: string;
  primary?: boolean;
  accessRole: 'freeBusyReader' | 'reader' | 'writer' | 'owner';
}

interface CalendarEvent {
  id: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string; // ISO 8601 for timed events
    date?: string;     // YYYY-MM-DD for all-day events
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  /** Organizer info */
  organizer?: {
    email: string;
    displayName?: string;
    self?: boolean;
  };
  /** Creator info */
  creator?: {
    email: string;
    displayName?: string;
    self?: boolean;
  };
  /** Attendees list */
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted';
    self?: boolean;
    organizer?: boolean;
  }>;
  /** Google Meet / conference info */
  conferenceData?: {
    conferenceId?: string;
    conferenceSolution?: {
      name: string; // e.g., "Google Meet"
      iconUri: string;
    };
    entryPoints?: Array<{
      entryPointType: 'video' | 'phone' | 'sip' | 'more';
      uri: string;
      label?: string;
    }>;
  };
  /** Attachments (including Drive links like Gemini transcripts) */
  attachments?: Array<{
    fileId: string;
    fileUrl: string;
    title: string;
    mimeType: string;
    iconLink?: string;
  }>;
  htmlLink: string;
  created: string;
  updated: string;
  recurringEventId?: string;
}

// ============================================================================
// OPTION TYPES
// ============================================================================

interface CalendarEventListOptions {
  /** Calendar ID (default: 'primary') */
  calendarId?: string;
  /** Lower bound (ISO 8601) — required for orderBy=startTime */
  timeMin?: string;
  /** Upper bound (ISO 8601) */
  timeMax?: string;
  /** Max events to return (default: 50) */
  maxResults?: number;
  /** Expand recurring events (default: true) */
  singleEvents?: boolean;
  /** Sort order: 'startTime' (default) or 'updated' */
  orderBy?: 'startTime' | 'updated';
  /** Free-text search query */
  query?: string;
  /** Page token */
  pageToken?: string;
}

// ============================================================================
// RESULT TYPES
// ============================================================================

interface CalendarListResult {
  items: CalendarEntry[];
  nextPageToken?: string;
}

interface CalendarEventListResult {
  items: CalendarEvent[];
  nextPageToken?: string;
  summary: string;
  timeZone: string;
}

// ============================================================================
// API INTERFACE
// ============================================================================

interface CalendarCalendarsAPI {
  /**
   * List all calendars the user has access to
   *
   * @example
   * const result = await calendar.calendars.list();
   * for (const cal of result.items) {
   *   console.log(`${cal.summary} (${cal.id}) ${cal.primary ? '★' : ''}`);
   * }
   */
  list(): Promise<CalendarListResult>;

  /**
   * Get calendar details
   */
  get(calendarId?: string): Promise<CalendarEntry>;
}

interface CalendarEventsAPI {
  /**
   * List events from a calendar
   *
   * @example
   * // Today's events
   * const now = new Date();
   * const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59);
   * const result = await calendar.events.list({
   *   timeMin: now.toISOString(),
   *   timeMax: endOfDay.toISOString()
   * });
   * for (const event of result.items) {
   *   console.log(`${event.start.dateTime || event.start.date}: ${event.summary}`);
   * }
   *
   * @example
   * // This week's events with Meet links
   * const now = new Date();
   * const nextWeek = new Date(now.getTime() + 7 * 86400000);
   * const result = await calendar.events.list({
   *   timeMin: now.toISOString(),
   *   timeMax: nextWeek.toISOString()
   * });
   * for (const event of result.items) {
   *   const meet = event.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video');
   *   console.log(`${event.summary}${meet ? ' — ' + meet.uri : ''}`);
   * }
   */
  list(options?: CalendarEventListOptions): Promise<CalendarEventListResult>;

  /**
   * Get a single event by ID
   *
   * @example
   * const event = await calendar.events.get('event_id');
   * console.log(event.summary);
   * // Check for Gemini transcript attachments
   * for (const att of event.attachments || []) {
   *   console.log(`Attachment: ${att.title} (${att.fileUrl})`);
   * }
   */
  get(eventId: string, options?: { calendarId?: string }): Promise<CalendarEvent>;

  /**
   * Search events by text query
   *
   * @example
   * const result = await calendar.events.search('standup', {
   *   timeMin: new Date(Date.now() - 30 * 86400000).toISOString()
   * });
   * for (const event of result.items) {
   *   console.log(`${event.start.dateTime}: ${event.summary}`);
   * }
   */
  search(query: string, options?: CalendarEventListOptions): Promise<CalendarEventListResult>;
}

interface CalendarAPI {
  calendars: CalendarCalendarsAPI;
  events: CalendarEventsAPI;
}
