/**
 * Measures API Types
 *
 * Types for fetching project metrics including coverage, complexity,
 * technical debt, and code quality measurements.
 */

export interface Measure {
  metric: string;
  value?: string;
  periods?: PeriodValue[];
  bestValue?: boolean;
}

export interface PeriodValue {
  index: number;
  value: string;
  bestValue?: boolean;
}

export interface Period {
  index: number;
  mode: string;
  date?: string;
  parameter?: string;
}

export interface MeasureOptions {
  /** Branch name */
  branch?: string;
  /** Pull request ID */
  pullRequest?: string;
}

export interface MeasureResponse {
  component: {
    key: string;
    name: string;
    qualifier: string;
    measures: Measure[];
  };
  metrics?: Metric[];
  periods?: Period[];
}

export interface Metric {
  key: string;
  name: string;
  description?: string;
  domain?: string;
  type: string;
  higherValuesAreBetter?: boolean;
  qualitative?: boolean;
  hidden?: boolean;
  custom?: boolean;
}

export interface MetricSearchOptions {
  /** Results per page (default: 100, max: 500) */
  pageSize?: number;
  /** Page number (1-based) */
  page?: number;
}

export interface MetricSearchResponse {
  metrics: Metric[];
  total: number;
  p: number;
  ps: number;
}

/**
 * Common SonarQube Metrics Reference
 *
 * Use these metric keys with api.measures.get()
 *
 * === CODE SIZE ===
 * - ncloc: Lines of code (non-comment lines)
 * - lines: Total lines including comments
 * - files: Number of files
 * - classes: Number of classes
 * - functions: Number of functions
 * - statements: Number of statements
 *
 * === ISSUE COUNTS ===
 * - bugs: Bug count
 * - vulnerabilities: Vulnerability count
 * - code_smells: Code smell count
 * - security_hotspots: Security hotspot count
 *
 * === COVERAGE ===
 * - coverage: Overall test coverage %
 * - line_coverage: Line coverage %
 * - branch_coverage: Branch coverage %
 * - lines_to_cover: Lines to cover
 * - uncovered_lines: Uncovered lines
 * - uncovered_conditions: Uncovered conditions
 *
 * === DUPLICATION ===
 * - duplicated_lines_density: Duplication % (0-100)
 * - duplicated_lines: Number of duplicated lines
 * - duplicated_blocks: Number of duplicated blocks
 * - duplicated_files: Number of files with duplication
 *
 * === COMPLEXITY ===
 * - complexity: Cyclomatic complexity
 * - cognitive_complexity: Cognitive complexity
 * - complexity_in_classes: Complexity in classes
 * - complexity_in_functions: Complexity in functions
 *
 * === TECHNICAL DEBT ===
 * - sqale_index: Technical debt in minutes
 * - sqale_debt_ratio: Debt ratio % (debt/dev cost)
 * - sqale_rating: Maintainability rating (1=A, 2=B, 3=C, 4=D, 5=E)
 * - effort_to_reach_maintainability_rating_a: Effort to reach A rating
 *
 * === RELIABILITY ===
 * - reliability_rating: Reliability rating (1=A to 5=E)
 * - reliability_remediation_effort: Effort to fix bugs (minutes)
 *
 * === SECURITY ===
 * - security_rating: Security rating (1=A to 5=E)
 * - security_remediation_effort: Effort to fix vulnerabilities (minutes)
 * - security_review_rating: Security review rating (1=A to 5=E)
 * - security_hotspots_reviewed: % of hotspots reviewed
 *
 * === NEW CODE METRICS ===
 * Prefix any metric with 'new_' for new code period:
 * - new_bugs: New bugs in new code
 * - new_vulnerabilities: New vulnerabilities
 * - new_code_smells: New code smells
 * - new_coverage: Coverage on new code
 * - new_lines_to_cover: New lines to cover
 * - new_uncovered_lines: New uncovered lines
 * - new_duplicated_lines_density: Duplication in new code
 * - new_technical_debt: Technical debt in new code (minutes)
 *
 * === DOCUMENTATION ===
 * - comment_lines: Number of comment lines
 * - comment_lines_density: Comment density %
 * - public_documented_api_density: Public API documentation %
 * - public_undocumented_api: Undocumented public API
 *
 * @example
 * // Get key project metrics
 * const measures = await api.measures.get('my-project', [
 *   'ncloc',
 *   'bugs',
 *   'vulnerabilities',
 *   'coverage',
 *   'sqale_index'
 * ]);
 *
 * measures.component.measures.forEach(m => {
 *   console.log(`${m.metric}: ${m.value}`);
 * });
 *
 * @example
 * // Get PR new code metrics
 * const prMetrics = await api.measures.get('my-project',
 *   ['new_bugs', 'new_vulnerabilities', 'new_coverage'],
 *   { pullRequest: '123' }
 * );
 *
 * @example
 * // Convert technical debt to hours
 * const measures = await api.measures.get('my-project', ['sqale_index']);
 * const debtMinutes = parseInt(measures.component.measures[0].value);
 * const hours = Math.floor(debtMinutes / 60);
 * console.log(`Technical debt: ${hours} hours`);
 */
