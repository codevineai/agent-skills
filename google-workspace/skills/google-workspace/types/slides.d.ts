/**
 * Google Slides API Types
 *
 * Read presentation text and structure, create presentations, and edit slides.
 * Requires the `presentations` scope (granted by setup.js since 1.5.0).
 *
 * The presentation ID is the long token in the URL:
 *   https://docs.google.com/presentation/d/PRESENTATION_ID/edit
 *
 * Works on native Google Slides only. For an uploaded .pptx, use Drive.
 */

// ============================================================================
// RESPONSE TYPES
// ============================================================================

interface SlidesTextContent {
  textElements: Array<{ startIndex?: number; endIndex: number; textRun?: { content: string; style?: object }; paragraphMarker?: object }>;
}

interface SlidesPageElement {
  objectId: string;
  title?: string;
  description?: string;
  size?: object;
  transform?: object;
  shape?: {
    shapeType: string;
    text?: SlidesTextContent;
    /** type: 'TITLE' | 'BODY' | 'SUBTITLE' | 'CENTERED_TITLE' | ... */
    placeholder?: { type: string; index?: number; parentObjectId?: string };
  };
  table?: { rows: number; columns: number; tableRows: Array<{ tableCells: Array<{ text?: SlidesTextContent }> }> };
  image?: { contentUrl: string; sourceUrl?: string };
  elementGroup?: { children: SlidesPageElement[] };
}

interface SlidesPage {
  objectId: string;
  pageType?: 'SLIDE' | 'MASTER' | 'LAYOUT' | 'NOTES' | 'NOTES_MASTER';
  pageElements?: SlidesPageElement[];
  slideProperties?: {
    layoutObjectId: string;
    masterObjectId: string;
    notesPage?: SlidesPage & { notesProperties: { speakerNotesObjectId: string } };
  };
}

interface SlidesPresentation {
  presentationId: string;
  title: string;
  pageSize: object;
  slides: SlidesPage[];
  layouts?: SlidesPage[];
  masters?: SlidesPage[];
  revisionId?: string;
}

interface SlideText {
  /** 1-based slide number */
  index: number;
  objectId: string;
  /** Text of all shapes, tables, and groups on the slide */
  text: string;
  /** Speaker notes */
  notes: string;
}

interface SlidesBatchUpdateResult {
  presentationId: string;
  replies: object[];
}

/** Predefined layouts accepted by addSlide */
type SlideLayout =
  | 'BLANK' | 'TITLE' | 'TITLE_AND_BODY' | 'TITLE_AND_TWO_COLUMNS' | 'TITLE_ONLY'
  | 'SECTION_HEADER' | 'SECTION_TITLE_AND_DESCRIPTION' | 'ONE_COLUMN_TEXT'
  | 'MAIN_POINT' | 'BIG_NUMBER' | 'CAPTION_ONLY';

// ============================================================================
// API INTERFACE
// ============================================================================

interface SlidesPresentationsAPI {
  /**
   * Get the full presentation resource.
   *
   * @example
   * const deck = await slides.presentations.get('presentation_id');
   * console.log(`${deck.title}: ${deck.slides.length} slides`);
   */
  get(presentationId: string, options?: { fields?: string }): Promise<SlidesPresentation>;

  /** Create a presentation with one title slide in the user's Drive root. */
  create(options?: { title?: string }): Promise<SlidesPresentation>;

  /**
   * Apply edits. `requests` is an array of Slides API Request objects:
   * https://developers.google.com/slides/api/reference/rest/v1/presentations/request
   *
   * @example
   * // Fill the title and body placeholders of a slide
   * const page = await slides.pages.get('presentation_id', slideId);
   * const title = page.pageElements.find(e => e.shape?.placeholder?.type === 'TITLE');
   * const body = page.pageElements.find(e => e.shape?.placeholder?.type === 'BODY');
   * await slides.presentations.batchUpdate('presentation_id', [
   *   { insertText: { objectId: title.objectId, text: 'Q3 results' } },
   *   { insertText: { objectId: body.objectId, text: 'Revenue up\nCosts flat' } }
   * ]);
   */
  batchUpdate(presentationId: string, requests: object[], options?: { writeControl?: { requiredRevisionId: string } }): Promise<SlidesBatchUpdateResult>;
}

interface SlidesPagesAPI {
  /** Get one slide (or layout/master) by object ID. */
  get(presentationId: string, pageId: string): Promise<SlidesPage>;

  /**
   * Get a rendered image of a slide. contentUrl is a short-lived PNG URL (about 30 minutes).
   *
   * @example
   * const thumb = await slides.pages.getThumbnail('presentation_id', slideId, { size: 'LARGE' });
   * console.log(thumb.contentUrl);
   */
  getThumbnail(presentationId: string, pageId: string, options?: { size?: 'SMALL' | 'MEDIUM' | 'LARGE'; mimeType?: 'PNG' }): Promise<{ contentUrl: string; width: number; height: number }>;
}

interface SlidesAPI {
  presentations: SlidesPresentationsAPI;
  pages: SlidesPagesAPI;

  /**
   * Text and speaker notes of every slide.
   *
   * @example
   * for (const s of await slides.getText('presentation_id')) {
   *   console.log(`--- Slide ${s.index}\n${s.text}`);
   *   if (s.notes.trim()) console.log(`Notes: ${s.notes}`);
   * }
   */
  getText(presentationId: string): Promise<SlideText[]>;

  /**
   * Add a slide. Appended at the end unless insertionIndex (0-based) is given.
   * Returns the new slide's objectId.
   *
   * @example
   * const slideId = await slides.addSlide('presentation_id', { layout: 'TITLE_AND_BODY' });
   */
  addSlide(presentationId: string, options?: { layout?: SlideLayout; insertionIndex?: number; objectId?: string }): Promise<string>;

  /**
   * Replace every occurrence of `find` across the deck (or only on pageObjectIds).
   * Case-sensitive unless matchCase is false. Returns the number of replacements.
   *
   * @example
   * await slides.replaceText('presentation_id', '{{date}}', 'Sept 27, 2026');
   */
  replaceText(presentationId: string, find: string, replacement: string, options?: { matchCase?: boolean; pageObjectIds?: string[] }): Promise<number>;
}
