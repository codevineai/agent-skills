/**
 * SonarQube API Interface
 *
 * Main API object providing access to all SonarQube endpoints.
 * This file imports and combines all the domain-specific type definitions.
 *
 * Usage: Read the specific type files for detailed information:
 * - types/projects.d.ts - Project search
 * - types/issues.d.ts - Issue search and analysis
 * - types/quality-gates.d.ts - Quality gate status
 * - types/measures.d.ts - Metrics and measurements (includes metric reference)
 * - types/rules.d.ts - Rule definitions
 * - types/sources.d.ts - Source code access
 * - types/system.d.ts - System health and status
 */

import {
  ProjectSearchOptions,
  ProjectSearchResponse
} from './projects';

import {
  IssueSearchOptions,
  IssueSearchResponse
} from './issues';

import {
  QualityGateStatusOptions,
  QualityGateStatusResponse,
  QualityGateListResponse
} from './quality-gates';

import {
  MeasureOptions,
  MeasureResponse,
  MetricSearchOptions,
  MetricSearchResponse
} from './measures';

import {
  RuleDetail,
  RuleRepositoryOptions,
  RuleRepositoryResponse
} from './rules';

import {
  SourcesOptions,
  ScmOptions,
  ScmInfo
} from './sources';

import {
  SystemHealthResponse,
  SystemStatusResponse,
  LanguageListOptions,
  LanguageListResponse
} from './system';

/**
 * SonarQube API
 *
 * Complete API interface for SonarQube REST endpoints.
 * See individual type files for detailed documentation and examples.
 */
export interface SonarQubeAPI {
  /**
   * Projects API - Search and list projects
   * See types/projects.d.ts for details
   */
  projects: {
    search(options?: ProjectSearchOptions): Promise<ProjectSearchResponse>;
  };

  /**
   * Issues API - Search bugs, vulnerabilities, code smells
   * See types/issues.d.ts for details
   */
  issues: {
    search(options?: IssueSearchOptions): Promise<IssueSearchResponse>;
  };

  /**
   * Quality Gates API - Check quality gate status
   * See types/quality-gates.d.ts for details
   */
  qualityGates: {
    getStatus(
      projectKey: string,
      options?: QualityGateStatusOptions
    ): Promise<QualityGateStatusResponse>;
    list(): Promise<QualityGateListResponse>;
  };

  /**
   * Measures API - Get metrics and measurements
   * See types/measures.d.ts for complete metric reference
   */
  measures: {
    get(
      componentKey: string,
      metricKeys: string | string[],
      options?: MeasureOptions
    ): Promise<MeasureResponse>;
  };

  /**
   * Rules API - Get rule definitions and remediation guidance
   * See types/rules.d.ts for details
   */
  rules: {
    get(ruleKey: string): Promise<RuleDetail>;
    listRepositories(options?: RuleRepositoryOptions): Promise<RuleRepositoryResponse>;
  };

  /**
   * Sources API - Get source code and SCM information
   * See types/sources.d.ts for details
   */
  sources: {
    getRaw(fileKey: string, options?: SourcesOptions): Promise<string>;
    getScm(fileKey: string, options?: ScmOptions): Promise<ScmInfo>;
  };

  /**
   * System API - Check system health and status
   * See types/system.d.ts for details
   */
  system: {
    health(): Promise<SystemHealthResponse>;
    status(): Promise<SystemStatusResponse>;
  };

  /**
   * Languages API - List supported languages
   * See types/system.d.ts for details
   */
  languages: {
    list(options?: LanguageListOptions): Promise<LanguageListResponse>;
  };

  /**
   * Metrics API - Search available metrics
   * See types/measures.d.ts for details
   */
  metrics: {
    search(options?: MetricSearchOptions): Promise<MetricSearchResponse>;
  };
}
