/**
 * Google Drive API Types
 *
 * Access files, search, and download/export content. Read-only (drive.readonly scope).
 */

// ============================================================================
// RESPONSE TYPES
// ============================================================================

interface DriveFile {
  id: string;
  name: string;
  /** Common types:
   * - 'application/vnd.google-apps.document' (Google Doc)
   * - 'application/vnd.google-apps.spreadsheet' (Google Sheet)
   * - 'application/vnd.google-apps.presentation' (Google Slides)
   * - 'application/vnd.google-apps.folder' (Folder)
   * - 'application/pdf', 'text/plain', etc. (uploaded files)
   */
  mimeType: string;
  modifiedTime: string;
  size?: string;
  webViewLink?: string;
  parents?: string[];
  description?: string;
}

interface DrivePermission {
  id: string;
  type: 'user' | 'group' | 'domain' | 'anyone';
  role: 'owner' | 'organizer' | 'fileOrganizer' | 'writer' | 'commenter' | 'reader';
  emailAddress?: string;
  displayName?: string;
}

interface DriveAbout {
  user: {
    displayName: string;
    emailAddress: string;
    photoLink?: string;
  };
  storageQuota: {
    limit?: string;
    usage: string;
    usageInDrive: string;
    usageInDriveTrash: string;
  };
}

// ============================================================================
// OPTION TYPES
// ============================================================================

interface DriveFileListOptions {
  /** Drive search query (see https://developers.google.com/drive/api/guides/search-files)
   *
   * Common queries:
   * - "name contains 'transcript'"
   * - "mimeType = 'application/vnd.google-apps.document'"
   * - "'folder_id' in parents"
   * - "modifiedTime > '2024-01-01'"
   * - "trashed = false"
   */
  query?: string;
  /** Max files (default: 20) */
  pageSize?: number;
  /** Fields to include in response */
  fields?: string;
  /** Sort order (default: 'modifiedTime desc') */
  orderBy?: string;
  /** Page token for pagination */
  pageToken?: string;
  /** Search space: 'drive' (default) or 'appDataFolder' */
  spaces?: string;
  /** Include shared drive results */
  includeSharedDrives?: boolean;
}

interface DriveFileSearchOptions {
  /** Filter by MIME type */
  mimeType?: string;
  /** Restrict to folder */
  folderId?: string;
  /** Max results (default: 20) */
  pageSize?: number;
  /** Fields to include */
  fields?: string;
  /** Include shared drives */
  includeSharedDrives?: boolean;
}

// ============================================================================
// RESULT TYPES
// ============================================================================

interface DriveFileListResult {
  files: DriveFile[];
  nextPageToken?: string;
}

interface DrivePermissionListResult {
  permissions: DrivePermission[];
}

// ============================================================================
// API INTERFACE
// ============================================================================

interface DriveFilesAPI {
  /**
   * List files with optional query filter
   *
   * @example
   * // Recent Google Docs
   * const result = await drive.files.list({
   *   query: "mimeType = 'application/vnd.google-apps.document'",
   *   pageSize: 10
   * });
   * for (const f of result.files) {
   *   console.log(`${f.name} — ${f.webViewLink}`);
   * }
   *
   * @example
   * // Files modified today
   * const today = new Date().toISOString().split('T')[0];
   * const result = await drive.files.list({
   *   query: `modifiedTime > '${today}' and trashed = false`
   * });
   */
  list(options?: DriveFileListOptions): Promise<DriveFileListResult>;

  /**
   * Get file metadata by ID
   *
   * @example
   * const file = await drive.files.get('file_id_from_url');
   * console.log(`${file.name} (${file.mimeType})`);
   */
  get(fileId: string, options?: { fields?: string }): Promise<DriveFile>;

  /**
   * Download file content as text (for non-Google-native files like .txt, .csv, .json)
   *
   * @example
   * const content = await drive.files.getContent('file_id');
   * console.log(content);
   */
  getContent(fileId: string): Promise<string>;

  /**
   * Export a Google-native file (Doc, Sheet, Slide) as text.
   * This is how you read Google Docs content including Gemini meeting transcripts.
   *
   * @example
   * // Export a Google Doc as plain text
   * const text = await drive.files.exportAsText('doc_id');
   * console.log(text);
   *
   * @example
   * // Export as HTML for richer formatting
   * const html = await drive.files.exportAsText('doc_id', 'text/html');
   *
   * Supported export MIME types for Google Docs:
   * - 'text/plain' (default)
   * - 'text/html'
   * - 'application/pdf'
   * - 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' (.docx)
   */
  exportAsText(fileId: string, mimeType?: string): Promise<string>;

  /**
   * Search files by name (convenience wrapper around list with query)
   *
   * @example
   * // Find meeting transcripts
   * const result = await drive.files.search('transcript');
   * for (const f of result.files) {
   *   console.log(`${f.name} — ${f.modifiedTime}`);
   * }
   *
   * @example
   * // Find Google Docs with "standup" in the name
   * const result = await drive.files.search('standup', {
   *   mimeType: 'application/vnd.google-apps.document'
   * });
   */
  search(name: string, options?: DriveFileSearchOptions): Promise<DriveFileListResult>;
}

interface DrivePermissionsAPI {
  /**
   * List who has access to a file
   *
   * @example
   * const result = await drive.permissions.list('file_id');
   * for (const p of result.permissions) {
   *   console.log(`${p.emailAddress}: ${p.role}`);
   * }
   */
  list(fileId: string): Promise<DrivePermissionListResult>;
}

interface DriveAboutAPI {
  /**
   * Get info about the authenticated user and storage
   *
   * @example
   * const about = await drive.about.get();
   * console.log(`Logged in as: ${about.user.emailAddress}`);
   */
  get(): Promise<DriveAbout>;
}

interface DriveAPI {
  files: DriveFilesAPI;
  permissions: DrivePermissionsAPI;
  about: DriveAboutAPI;
}
