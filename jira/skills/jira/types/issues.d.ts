/**
 * Jira Issues API Types
 */

// --- Common Types ---

interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  active: boolean;
  avatarUrls?: Record<string, string>;
}

interface JiraStatus {
  id: string;
  name: string;
  statusCategory: {
    id: number;
    key: string;  // 'new' | 'indeterminate' | 'done'
    name: string;
  };
}

interface JiraPriority {
  id: string;
  name: string;  // 'Highest', 'High', 'Medium', 'Low', 'Lowest'
}

interface JiraIssueType {
  id: string;
  name: string;  // 'Bug', 'Story', 'Task', 'Epic'
  subtask: boolean;
}

// --- Issue ---

interface JiraIssue {
  id: string;
  key: string;  // e.g., 'PROJ-123'
  self: string;
  fields: {
    summary: string;
    description?: any;  // Atlassian Document Format
    status: JiraStatus;
    assignee?: JiraUser;
    reporter?: JiraUser;
    priority?: JiraPriority;
    issuetype: JiraIssueType;
    project: { id: string; key: string; name: string };
    parent?: { id: string; key: string };
    labels?: string[];
    components?: Array<{ id: string; name: string }>;
    fixVersions?: Array<{ id: string; name: string }>;
    created: string;
    updated: string;
    duedate?: string;
    [customField: string]: any;
  };
}

// --- Search ---

interface IssueSearchOptions {
  /** Fields to return (default: key, summary, status, assignee, priority, created, updated) */
  fields?: string[];
  /** Max results (default: 50) */
  maxResults?: number;
  /** Pagination token from previous result */
  nextPageToken?: string;
  /** Expand additional data */
  expand?: string;
}

interface IssueSearchResult {
  issues: JiraIssue[];
  nextPageToken?: string;
  isLast: boolean;
}

// --- Create ---

interface IssueCreateFields {
  /** Project key or id (required) */
  project: { key: string } | { id: string };
  /** Issue type (required) */
  issuetype: { name: string } | { id: string };
  /** Summary/title (required) */
  summary: string;
  /** Description in Atlassian Document Format (optional) */
  description?: any;
  /** Priority (optional) */
  priority?: { name: string } | { id: string };
  /** Labels (optional) */
  labels?: string[];
  /** Assignee (optional) */
  assignee?: { accountId: string } | null;
  /** Parent issue for subtasks, or epic for tasks (optional) */
  parent?: { key: string } | { id: string };
  /** Components (optional) */
  components?: Array<{ name: string } | { id: string }>;
  /** Fix versions (optional) */
  fixVersions?: Array<{ name: string } | { id: string }>;
  /** Due date YYYY-MM-DD (optional) */
  duedate?: string;
  /** Any custom fields */
  [customField: string]: any;
}

interface IssueCreateResult {
  id: string;
  key: string;  // e.g., 'PROJ-123'
  self: string;
}

interface BulkCreateResult {
  issues: IssueCreateResult[];
  errors: Array<{
    status: number;
    elementErrors: { errors: Record<string, string>; errorMessages: string[] };
    failedElementNumber: number;
  }>;
}

// --- Update ---

interface IssueUpdateFields {
  summary?: string;
  description?: any;
  assignee?: { accountId: string } | null;
  priority?: { name: string } | { id: string };
  labels?: string[];
  parent?: { key: string } | { id: string };
  components?: Array<{ name: string } | { id: string }>;
  fixVersions?: Array<{ name: string } | { id: string }>;
  duedate?: string | null;
  [customField: string]: any;
}

interface IssueUpdateOperations {
  labels?: Array<{ set: string[] } | { add: string } | { remove: string }>;
  components?: Array<{ set: Array<{ name: string }> } | { add: { name: string } } | { remove: { name: string } }>;
  [field: string]: any;
}

// --- Comments ---

interface JiraComment {
  id: string;
  self: string;
  author: JiraUser;
  body: any;  // Atlassian Document Format
  created: string;
  updated: string;
}

interface CommentListResult {
  comments: JiraComment[];
  startAt: number;
  maxResults: number;
  total: number;
}

// --- Transitions ---

interface JiraTransition {
  id: string;
  name: string;
  to: JiraStatus;
}

// --- API Interface ---

interface IssuesAPI {
  /**
   * Search issues with JQL
   * @example
   * const result = await jira.issues.search('assignee = currentUser() ORDER BY updated DESC');
   */
  search(jql: string, options?: IssueSearchOptions): Promise<IssueSearchResult>;

  /**
   * Get issue by key
   * @example
   * const issue = await jira.issues.get('PROJ-123');
   */
  get(key: string, options?: { fields?: string[]; expand?: string }): Promise<JiraIssue>;

  /**
   * Create a new issue
   * @example
   * const result = await jira.issues.create({
   *   project: { key: 'PROJ' },
   *   issuetype: { name: 'Task' },
   *   summary: 'My new task',
   *   description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Details here' }] }] },
   *   priority: { name: 'High' },
   *   labels: ['backend']
   * });
   * console.log(result.key);  // 'PROJ-456'
   *
   * @example
   * // Create a task under an epic
   * await jira.issues.create({
   *   project: { key: 'PROJ' },
   *   issuetype: { name: 'Task' },
   *   summary: 'Subtask of epic',
   *   parent: { key: 'PROJ-100' }
   * });
   */
  create(fields: IssueCreateFields): Promise<IssueCreateResult>;

  /**
   * Create multiple issues in one call (up to 50)
   * @example
   * const result = await jira.issues.createBulk([
   *   { fields: { project: { key: 'PROJ' }, issuetype: { name: 'Task' }, summary: 'Task 1' } },
   *   { fields: { project: { key: 'PROJ' }, issuetype: { name: 'Task' }, summary: 'Task 2' } }
   * ]);
   * for (const issue of result.issues) console.log(issue.key);
   */
  createBulk(issueUpdates: Array<{ fields: IssueCreateFields }>): Promise<BulkCreateResult>;

  /**
   * Update issue fields
   * @example
   * await jira.issues.update('PROJ-123', { summary: 'New title', priority: { name: 'High' } });
   */
  update(key: string, fields: IssueUpdateFields): Promise<null>;

  /**
   * Update with operations (add/remove for multi-value fields)
   * @example
   * await jira.issues.updateWithOperations('PROJ-123', { labels: [{ add: 'urgent' }] });
   */
  updateWithOperations(key: string, operations: IssueUpdateOperations): Promise<null>;

  /**
   * Delete an issue
   * @example
   * await jira.issues.delete('PROJ-123');
   */
  delete(key: string): Promise<null>;

  /**
   * Get available transitions
   * @example
   * const { transitions } = await jira.issues.getTransitions('PROJ-123');
   */
  getTransitions(key: string): Promise<{ transitions: JiraTransition[] }>;

  /**
   * Transition issue to new status
   * @example
   * await jira.issues.transition('PROJ-123', '31');  // transition ID from getTransitions
   */
  transition(key: string, transitionId: string, fields?: IssueUpdateFields): Promise<null>;

  /**
   * Get editable fields metadata
   */
  getEditMeta(key: string): Promise<{ fields: Record<string, any> }>;

  /**
   * Add a comment to an issue (accepts plain string or Atlassian Document Format)
   * @example
   * await jira.issues.addComment('PROJ-123', 'This is a plain text comment');
   *
   * @example
   * // Atlassian Document Format for rich text
   * await jira.issues.addComment('PROJ-123', {
   *   type: 'doc', version: 1,
   *   content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rich comment' }] }]
   * });
   */
  addComment(key: string, body: string | any): Promise<JiraComment>;

  /**
   * Get comments on an issue
   * @example
   * const result = await jira.issues.getComments('PROJ-123');
   * for (const c of result.comments) console.log(`${c.author.displayName}: ${c.created}`);
   */
  getComments(key: string, options?: { maxResults?: number; startAt?: number; orderBy?: string }): Promise<CommentListResult>;

  /**
   * Link two issues together
   * @example
   * // Common link types: "Blocks", "Cloners", "Duplicate", "Relates"
   * await jira.issues.link('Blocks', 'PROJ-100', 'PROJ-200');
   */
  link(type: string, inwardKey: string, outwardKey: string): Promise<null>;
}
