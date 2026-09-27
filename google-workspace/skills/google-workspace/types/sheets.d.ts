/**
 * Google Sheets API Types
 *
 * Read and write spreadsheet values, create spreadsheets, and manage tabs.
 * Requires the `spreadsheets` scope (granted by setup.js since 1.5.0).
 *
 * The spreadsheet ID is the long token in the URL:
 *   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
 *
 * Ranges use A1 notation: 'Sheet1!A1:D20', 'Sheet1!A:C', 'Sheet1' (whole tab).
 * Quote tab names that contain spaces: "'Q3 Plan'!A1:B5".
 */

// ============================================================================
// RESPONSE TYPES
// ============================================================================

interface SheetProperties {
  /** Numeric tab ID (the `gid` in the URL) — used by deleteSheet and batchUpdate requests */
  sheetId: number;
  title: string;
  index: number;
  sheetType?: string;
  gridProperties?: { rowCount: number; columnCount: number; frozenRowCount?: number; frozenColumnCount?: number };
  hidden?: boolean;
}

interface Spreadsheet {
  spreadsheetId: string;
  spreadsheetUrl: string;
  properties: { title: string; locale?: string; timeZone?: string };
  sheets: Array<{ properties: SheetProperties }>;
}

/** Cell values. Rows of cells; trailing empty cells and rows are omitted. */
type SheetValues = Array<Array<string | number | boolean>>;

interface ValueRange {
  range: string;
  majorDimension: 'ROWS' | 'COLUMNS';
  /** Absent when the range is empty */
  values?: SheetValues;
}

interface UpdateValuesResult {
  spreadsheetId: string;
  updatedRange: string;
  updatedRows: number;
  updatedColumns: number;
  updatedCells: number;
}

// ============================================================================
// OPTION TYPES
// ============================================================================

interface SheetReadOptions {
  /** 'ROWS' (default) or 'COLUMNS' */
  majorDimension?: 'ROWS' | 'COLUMNS';
  /** 'FORMATTED_VALUE' (default, strings as displayed), 'UNFORMATTED_VALUE' (raw numbers), or 'FORMULA' */
  valueRenderOption?: 'FORMATTED_VALUE' | 'UNFORMATTED_VALUE' | 'FORMULA';
  /** 'SERIAL_NUMBER' (default) or 'FORMATTED_STRING'. Ignored with FORMATTED_VALUE. */
  dateTimeRenderOption?: 'SERIAL_NUMBER' | 'FORMATTED_STRING';
}

interface SheetWriteOptions {
  /** 'USER_ENTERED' (default — parses formulas, numbers, dates as if typed) or 'RAW' (stored verbatim) */
  valueInputOption?: 'USER_ENTERED' | 'RAW';
  majorDimension?: 'ROWS' | 'COLUMNS';
}

// ============================================================================
// API INTERFACE
// ============================================================================

interface SpreadsheetsAPI {
  /**
   * Get spreadsheet metadata: title and tabs. Does not return cell values
   * unless includeGridData is set — use values.get for values.
   *
   * @example
   * const ss = await sheets.spreadsheets.get('spreadsheet_id');
   * for (const s of ss.sheets) console.log(s.properties.sheetId, s.properties.title);
   */
  get(spreadsheetId: string, options?: { ranges?: string[]; includeGridData?: boolean; fields?: string }): Promise<Spreadsheet>;

  /**
   * Create a spreadsheet in the user's Drive root.
   *
   * @example
   * const ss = await sheets.spreadsheets.create({ title: 'Q3 Forecast', sheets: ['Data', 'Summary'] });
   * console.log(ss.spreadsheetUrl);
   */
  create(options?: { title?: string; sheets?: string[] }): Promise<Spreadsheet>;

  /**
   * Structural and formatting changes. `requests` is an array of Sheets API Request
   * objects: https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/request
   *
   * @example
   * // Bold and freeze the header row of tab 0
   * await sheets.spreadsheets.batchUpdate('spreadsheet_id', [
   *   { repeatCell: { range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
   *       cell: { userEnteredFormat: { textFormat: { bold: true } } },
   *       fields: 'userEnteredFormat.textFormat.bold' } },
   *   { updateSheetProperties: { properties: { sheetId: 0, gridProperties: { frozenRowCount: 1 } },
   *       fields: 'gridProperties.frozenRowCount' } }
   * ]);
   */
  batchUpdate(spreadsheetId: string, requests: object[], options?: { includeSpreadsheetInResponse?: boolean }): Promise<{ spreadsheetId: string; replies: object[] }>;
}

interface SheetValuesAPI {
  /**
   * Read a range.
   *
   * @example
   * const { values } = await sheets.values.get('spreadsheet_id', 'Data!A1:D20');
   * for (const row of values || []) console.log(row.join(' | '));
   *
   * @example
   * // Raw numbers instead of display strings
   * const r = await sheets.values.get('spreadsheet_id', 'Data!B2:B', { valueRenderOption: 'UNFORMATTED_VALUE' });
   */
  get(spreadsheetId: string, range: string, options?: SheetReadOptions): Promise<ValueRange>;

  /** Read several ranges in one call. */
  batchGet(spreadsheetId: string, ranges: string[], options?: SheetReadOptions): Promise<{ spreadsheetId: string; valueRanges: ValueRange[] }>;

  /**
   * Overwrite a range, starting at its top-left cell.
   *
   * @example
   * await sheets.values.update('spreadsheet_id', 'Data!A1', [
   *   ['name', 'qty'],
   *   ['widgets', 12],
   *   ['total', '=SUM(B2:B2)']
   * ]);
   */
  update(spreadsheetId: string, range: string, values: SheetValues, options?: SheetWriteOptions): Promise<UpdateValuesResult>;

  /**
   * Append rows after the last row of the table that `range` touches.
   *
   * @example
   * await sheets.values.append('spreadsheet_id', 'Data!A1', [['gadgets', 7]]);
   */
  append(spreadsheetId: string, range: string, values: SheetValues, options?: SheetWriteOptions & { insertDataOption?: 'OVERWRITE' | 'INSERT_ROWS' }): Promise<{ spreadsheetId: string; tableRange?: string; updates: UpdateValuesResult }>;

  /** Clear values in a range. Formatting is kept. */
  clear(spreadsheetId: string, range: string): Promise<{ spreadsheetId: string; clearedRange: string }>;

  /**
   * Write several ranges in one call.
   *
   * @example
   * await sheets.values.batchUpdate('spreadsheet_id', [
   *   { range: 'Data!A1', values: [['x']] },
   *   { range: 'Summary!B2', values: [['=Data!A1']] }
   * ]);
   */
  batchUpdate(spreadsheetId: string, data: Array<{ range: string; values: SheetValues }>, options?: { valueInputOption?: 'USER_ENTERED' | 'RAW' }): Promise<{ spreadsheetId: string; totalUpdatedCells: number; responses: UpdateValuesResult[] }>;
}

interface SheetsAPI {
  spreadsheets: SpreadsheetsAPI;
  values: SheetValuesAPI;

  /**
   * Add a tab. Returns its properties, including the numeric sheetId.
   *
   * @example
   * const tab = await sheets.addSheet('spreadsheet_id', 'October');
   */
  addSheet(spreadsheetId: string, title: string, options?: { index?: number }): Promise<SheetProperties>;

  /** Delete a tab by numeric sheetId (not the title). */
  deleteSheet(spreadsheetId: string, sheetId: number): Promise<{ spreadsheetId: string; replies: object[] }>;
}
