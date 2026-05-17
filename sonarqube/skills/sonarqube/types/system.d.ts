/**
 * System API Types
 *
 * Types for checking SonarQube system health and status.
 */

import { SystemHealth } from './common';

export interface SystemHealthResponse {
  health: SystemHealth;
  causes?: string[];
}

export interface SystemStatusResponse {
  id: string;
  version: string;
  status: string;
}

export interface Language {
  key: string;
  name: string;
}

export interface LanguageListOptions {
  /** Pattern to match language keys/names */
  query?: string;
}

export interface LanguageListResponse {
  languages: Language[];
}

/**
 * @example
 * // Check system health
 * const health = await api.system.health();
 * console.log(`Health: ${health.health}`);
 *
 * if (health.health !== 'GREEN') {
 *   console.log('Issues:', health.causes);
 * }
 *
 * @example
 * // Get system version
 * const status = await api.system.status();
 * console.log(`SonarQube ${status.version}`);
 * console.log(`Status: ${status.status}`);
 *
 * @example
 * // Test connection
 * try {
 *   const health = await api.system.health();
 *   console.log('Connected to SonarQube');
 * } catch (error) {
 *   console.error('Cannot connect:', error.message);
 * }
 */
