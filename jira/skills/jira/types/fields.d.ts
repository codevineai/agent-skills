/**
 * Jira Fields API Types
 */

interface JiraField {
  id: string;  // 'summary', 'customfield_10001'
  key: string;
  name: string;
  custom: boolean;
  orderable: boolean;
  navigable: boolean;
  searchable: boolean;
  clauseNames: string[];  // JQL names
  schema?: {
    type: string;
    items?: string;
    system?: string;
    custom?: string;
    customId?: number;
  };
}

interface FieldsAPI {
  /**
   * List all fields (system and custom)
   * @example
   * const fields = await jira.fields.list();
   * const storyPoints = fields.find(f => f.name === 'Story Points');
   * console.log(storyPoints.id);  // e.g., 'customfield_10004'
   */
  list(): Promise<JiraField[]>;
}
