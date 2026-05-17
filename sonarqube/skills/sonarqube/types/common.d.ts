/**
 * Common Types
 *
 * Shared types used across multiple SonarQube API endpoints.
 */

export interface Paging {
  pageIndex: number;
  pageSize: number;
  total: number;
}

export type Severity = 'BLOCKER' | 'CRITICAL' | 'MAJOR' | 'MINOR' | 'INFO';
export type IssueType = 'BUG' | 'VULNERABILITY' | 'CODE_SMELL' | 'SECURITY_HOTSPOT';
export type IssueStatus = 'OPEN' | 'CONFIRMED' | 'REOPENED' | 'RESOLVED' | 'CLOSED';
export type Resolution = 'FALSE-POSITIVE' | 'WONTFIX' | 'FIXED' | 'REMOVED';
export type QualityGateStatus = 'OK' | 'WARN' | 'ERROR';
export type SystemHealth = 'GREEN' | 'YELLOW' | 'RED';

export interface Component {
  key: string;
  enabled: boolean;
  qualifier: string;
  name: string;
  longName: string;
  path?: string;
}

export interface User {
  login: string;
  name: string;
  active: boolean;
}
