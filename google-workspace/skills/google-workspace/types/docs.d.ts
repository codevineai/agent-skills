/**
 * Google Docs API Types
 *
 * Read document text and structure, create documents, and edit content.
 * Requires the `documents` scope (granted by setup.js since 1.5.0).
 *
 * The document ID is the long token in the URL:
 *   https://docs.google.com/document/d/DOCUMENT_ID/edit
 *
 * Reading text only? `docs.getText(id)` works on any Doc. `drive.files.exportAsText(id)`
 * is the alternative and also handles Markdown/HTML export.
 */

// ============================================================================
// RESPONSE TYPES
// ============================================================================

interface DocsDocument {
  documentId: string;
  title: string;
  revisionId?: string;
  /** Body of the first tab. Absent when includeTabsContent is true (content is under `tabs`). */
  body?: { content: DocsStructuralElement[] };
  /** Present when includeTabsContent is true */
  tabs?: DocsTab[];
}

interface DocsTab {
  tabProperties: { tabId: string; title: string; index: number; parentTabId?: string };
  documentTab?: { body: { content: DocsStructuralElement[] } };
  childTabs?: DocsTab[];
}

interface DocsStructuralElement {
  /** Character offsets used by insertText/deleteContentRange */
  startIndex?: number;
  endIndex: number;
  paragraph?: {
    elements: Array<{ startIndex?: number; endIndex: number; textRun?: { content: string; textStyle?: object } }>;
    paragraphStyle?: { namedStyleType?: string };
  };
  table?: { rows: number; columns: number; tableRows: Array<{ tableCells: Array<{ content: DocsStructuralElement[] }> }> };
  sectionBreak?: object;
  tableOfContents?: { content: DocsStructuralElement[] };
}

interface DocsBatchUpdateResult {
  documentId: string;
  replies: object[];
  writeControl?: { requiredRevisionId: string };
}

// ============================================================================
// API INTERFACE
// ============================================================================

interface DocsDocumentsAPI {
  /**
   * Get the full document resource (structure, indexes, styles).
   *
   * @example
   * const doc = await docs.documents.get('document_id');
   * console.log(doc.title, doc.body.content.length);
   */
  get(documentId: string, options?: {
    /** Return every tab under `tabs` instead of only the first tab under `body` */
    includeTabsContent?: boolean;
    suggestionsViewMode?: 'DEFAULT_FOR_CURRENT_ACCESS' | 'SUGGESTIONS_INLINE' | 'PREVIEW_SUGGESTIONS_ACCEPTED' | 'PREVIEW_WITHOUT_SUGGESTIONS';
    fields?: string;
  }): Promise<DocsDocument>;

  /**
   * Create an empty document in the user's Drive root.
   *
   * @example
   * const doc = await docs.documents.create({ title: 'Meeting notes' });
   * await docs.appendText(doc.documentId, 'Agenda\n');
   */
  create(options?: { title?: string }): Promise<DocsDocument>;

  /**
   * Apply edits. `requests` is an array of Docs API Request objects:
   * https://developers.google.com/docs/api/reference/rest/v1/documents/request
   * Requests run in order; indexes in later requests must account for earlier inserts.
   *
   * @example
   * // Make the first 6 characters a heading
   * await docs.documents.batchUpdate('document_id', [
   *   { updateParagraphStyle: { range: { startIndex: 1, endIndex: 7 },
   *       paragraphStyle: { namedStyleType: 'HEADING_1' }, fields: 'namedStyleType' } }
   * ]);
   */
  batchUpdate(documentId: string, requests: object[], options?: { writeControl?: { requiredRevisionId?: string; targetRevisionId?: string } }): Promise<DocsBatchUpdateResult>;
}

interface DocsAPI {
  documents: DocsDocumentsAPI;

  /**
   * Plain text of the document. All tabs by default, in order, joined by a newline.
   * Table rows are one line each with tab-separated cells.
   *
   * @example
   * const text = await docs.getText('document_id');
   * console.log(text);
   */
  getText(documentId: string, options?: { tabId?: string }): Promise<string>;

  /**
   * Append text at the end of the body. Include '\n' to end paragraphs.
   *
   * @example
   * await docs.appendText('document_id', 'Action items\n- Send the report\n');
   */
  appendText(documentId: string, text: string, options?: { tabId?: string }): Promise<DocsBatchUpdateResult>;

  /** Insert text at a character index. Index 1 is the start of the body. */
  insertText(documentId: string, text: string, index: number, options?: { tabId?: string }): Promise<DocsBatchUpdateResult>;

  /**
   * Replace every occurrence of `find`. Case-sensitive unless matchCase is false.
   * Returns the number of replacements.
   *
   * @example
   * // Fill a template
   * const n = await docs.replaceText('document_id', '{{client}}', 'Acme Corp');
   */
  replaceText(documentId: string, find: string, replacement: string, options?: { matchCase?: boolean }): Promise<number>;
}
