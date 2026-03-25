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

// --- Update ---

interface IssueUpdateFields {
  summary?: string;
  description?: any;
  assignee?: { accountId: string } | null;
  priority?: { name: string } | { id: string };
  labels?: string[];
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
}
