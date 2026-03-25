/**
 * Jira Users API Types
 */

interface JiraUserDetail {
  accountId: string;
  accountType: string;  // 'atlassian', 'app', 'customer'
  displayName: string;
  emailAddress?: string;
  active: boolean;
  timeZone?: string;
}

interface UsersAPI {
  /**
   * Search users by name/email
   * @example
   * const users = await jira.users.search('john');
   */
  search(query: string, options?: { maxResults?: number; startAt?: number }): Promise<JiraUserDetail[]>;

  /**
   * Get users assignable to a project
   * @example
   * const users = await jira.users.assignable('PROJ', { query: 'john' });
   * await jira.issues.update('PROJ-123', { assignee: { accountId: users[0].accountId } });
   */
  assignable(project: string, options?: { query?: string; maxResults?: number }): Promise<JiraUserDetail[]>;
}
