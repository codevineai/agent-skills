/**
 * Projects API Types
 *
 * Types for searching and listing SonarQube projects.
 */

import { Paging } from './common';

export interface Project {
  key: string;
  name: string;
  qualifier: string;
  visibility: 'public' | 'private';
  lastAnalysisDate?: string;
  revision?: string;
}

export interface ProjectSearchOptions {
  /** Results per page (default: 100, max: 500) */
  pageSize?: number;
  /** Page number (1-based) */
  page?: number;
  /** Search query to filter projects by name or key */
  query?: string;
}

export interface ProjectSearchResponse {
  paging: Paging;
  components: Project[];
}

/**
 * @example
 * // List all projects
 * const projects = await api.projects.search();
 * console.log(`Found ${projects.paging.total} projects`);
 *
 * @example
 * // Search for specific project
 * const result = await api.projects.search({ query: 'rocket' });
 * if (result.components.length === 1) {
 *   const projectKey = result.components[0].key;
 * }
 */
