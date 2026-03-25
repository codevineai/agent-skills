/**
 * Jira Projects API Types
 */

interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;  // 'software', 'business', 'service_desk'
  style: string;  // 'classic' or 'next-gen'
  isPrivate: boolean;
  description?: string;
  lead?: {
    accountId: string;
    displayName: string;
  };
  issueTypes?: Array<{
    id: string;
    name: string;
    subtask: boolean;
  }>;
}

interface ProjectListOptions {
  maxResults?: number;
  startAt?: number;
  orderBy?: 'category' | 'key' | 'name' | 'owner';
  expand?: string;
}

interface ProjectListResult {
  values: JiraProject[];
  startAt: number;
  maxResults: number;
  total: number;
  isLast: boolean;
}

interface ProjectsAPI {
  /**
   * List projects
   * @example
   * const result = await jira.projects.list();
   * for (const p of result.values) console.log(p.key + ': ' + p.name);
   */
  list(options?: ProjectListOptions): Promise<ProjectListResult>;

  /**
   * Get project by key
   * @example
   * const project = await jira.projects.get('PROJ', { expand: 'issueTypes' });
   */
  get(key: string, options?: { expand?: string }): Promise<JiraProject>;
}
