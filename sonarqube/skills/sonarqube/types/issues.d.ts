/**
 * Issues API Types
 *
 * Types for searching and analyzing code quality issues including bugs,
 * vulnerabilities, code smells, and security hotspots.
 */

import { Paging, Severity, IssueType, IssueStatus, Resolution, Component, User } from './common';

export interface Issue {
  key: string;
  rule: string;
  severity: Severity;
  component: string;
  project: string;
  line?: number;
  hash?: string;
  textRange?: TextRange;
  flows?: Flow[];
  status: IssueStatus;
  message: string;
  effort?: string;
  debt?: string;
  assignee?: string;
  author?: string;
  tags?: string[];
  creationDate: string;
  updateDate: string;
  type: IssueType;
  scope?: string;
}

export interface TextRange {
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
}

export interface Flow {
  locations: Location[];
}

export interface Location {
  component: string;
  textRange: TextRange;
  msg?: string;
}

export interface IssueSearchOptions {
  /** Project keys to filter by */
  projects?: string[];
  /** Severities to filter by */
  severities?: Severity[];
  /** Issue types to filter by */
  types?: IssueType[];
  /** Statuses to filter by */
  statuses?: IssueStatus[];
  /** Resolutions to filter by */
  resolutions?: Resolution[];
  /** Branch name */
  branch?: string;
  /** Pull request ID */
  pullRequest?: string;
  /** Results per page (default: 100, max: 500) */
  pageSize?: number;
  /** Page number (1-based) */
  page?: number;
}

export interface IssueSearchResponse {
  paging: Paging;
  total: number;
  issues: Issue[];
  components: Component[];
  rules: RuleInfo[];
  users: User[];
}

export interface RuleInfo {
  key: string;
  name: string;
  status: string;
  lang?: string;
}

/**
 * @example
 * // Search for critical bugs in a project
 * const issues = await api.issues.search({
 *   projects: ['my-project'],
 *   severities: ['BLOCKER', 'CRITICAL'],
 *   types: ['BUG'],
 *   statuses: ['OPEN', 'CONFIRMED', 'REOPENED']
 * });
 * console.log(`Found ${issues.total} critical bugs`);
 *
 * @example
 * // Search for PR-specific issues
 * const prIssues = await api.issues.search({
 *   projects: ['my-project'],
 *   pullRequest: '123'
 * });
 *
 * @example
 * // Search for security vulnerabilities
 * const vulns = await api.issues.search({
 *   types: ['VULNERABILITY'],
 *   severities: ['CRITICAL', 'BLOCKER'],
 *   statuses: ['OPEN', 'CONFIRMED']
 * });
 */
