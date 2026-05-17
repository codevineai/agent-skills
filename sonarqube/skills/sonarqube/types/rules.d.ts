/**
 * Rules API Types
 *
 * Types for fetching rule definitions and remediation guidance.
 * Rules define what constitutes a bug, vulnerability, or code smell.
 */

import { Severity, IssueType } from './common';

export interface RuleDetail {
  rule: {
    key: string;
    repo: string;
    name: string;
    createdAt: string;
    htmlDesc?: string;
    htmlNote?: string;
    mdDesc?: string;
    mdNote?: string;
    severity: Severity;
    status: string;
    internalKey?: string;
    isTemplate?: boolean;
    tags?: string[];
    sysTags?: string[];
    lang?: string;
    langName?: string;
    scope?: string;
    isExternal?: boolean;
    type: IssueType;
    remFnType?: string;
    remFnBaseEffort?: string;
    gapDescription?: string;
  };
}

export interface RuleRepository {
  key: string;
  name: string;
  language: string;
}

export interface RuleRepositoryOptions {
  /** Language key to filter */
  language?: string;
  /** Search query */
  query?: string;
}

export interface RuleRepositoryResponse {
  repositories: RuleRepository[];
}

/**
 * @example
 * // Get rule details for an issue
 * const issue = issues.issues[0];
 * const rule = await api.rules.get(issue.rule);
 *
 * console.log(`Rule: ${rule.rule.name}`);
 * console.log(`Type: ${rule.rule.type}`);
 * console.log(`Severity: ${rule.rule.severity}`);
 * console.log(`Description: ${rule.rule.htmlDesc}`);
 *
 * if (rule.rule.htmlNote) {
 *   console.log(`How to fix: ${rule.rule.htmlNote}`);
 * }
 *
 * @example
 * // Get rule details for multiple issues
 * const issues = await api.issues.search({ projects: ['my-project'] });
 * const rulesMap = {};
 *
 * for (const issue of issues.issues) {
 *   if (!rulesMap[issue.rule]) {
 *     rulesMap[issue.rule] = await api.rules.get(issue.rule);
 *   }
 *
 *   const rule = rulesMap[issue.rule];
 *   console.log(`${issue.severity}: ${rule.rule.name}`);
 *   console.log(`  ${issue.message}`);
 *   console.log(`  ${issue.component}:${issue.line}`);
 * }
 */
