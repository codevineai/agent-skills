/**
 * Quality Gates API Types
 *
 * Types for checking quality gate status and conditions.
 * Quality gates define criteria that must be met for code to pass quality checks.
 */

import { QualityGateStatus } from './common';

export interface QualityGate {
  id: string;
  name: string;
  isDefault?: boolean;
  isBuiltIn?: boolean;
}

export interface QualityGateCondition {
  status: 'OK' | 'ERROR' | 'WARN';
  metricKey: string;
  comparator: 'GT' | 'LT' | 'EQ' | 'NE';
  errorThreshold?: string;
  warningThreshold?: string;
  actualValue?: string;
}

export interface Period {
  index: number;
  mode: string;
  date?: string;
  parameter?: string;
}

export interface QualityGateStatusOptions {
  /** Analysis ID */
  analysisId?: string;
  /** Branch name */
  branch?: string;
  /** Pull request ID */
  pullRequest?: string;
}

export interface QualityGateStatusResponse {
  projectStatus: {
    status: QualityGateStatus;
    conditions: QualityGateCondition[];
    periods?: Period[];
    ignoredConditions?: boolean;
  };
}

export interface QualityGateListResponse {
  qualitygates: QualityGate[];
  default?: string;
}

/**
 * @example
 * // Check project quality gate status
 * const qg = await api.qualityGates.getStatus('my-project');
 * console.log(`Status: ${qg.projectStatus.status}`);
 *
 * qg.projectStatus.conditions.forEach(c => {
 *   const icon = c.status === 'OK' ? '✓' : '✗';
 *   console.log(`${icon} ${c.metricKey}: ${c.actualValue}`);
 * });
 *
 * @example
 * // Check PR quality gate status
 * const prQG = await api.qualityGates.getStatus('my-project', {
 *   pullRequest: '123'
 * });
 * const passed = prQG.projectStatus.status === 'OK';
 * console.log(`PR Quality Gate: ${passed ? 'PASS' : 'FAIL'}`);
 *
 * @example
 * // Show failed conditions
 * const qg = await api.qualityGates.getStatus('my-project');
 * const failures = qg.projectStatus.conditions.filter(c => c.status === 'ERROR');
 *
 * failures.forEach(f => {
 *   console.log(`Failed: ${f.metricKey}`);
 *   console.log(`  Expected: ${f.comparator} ${f.errorThreshold}`);
 *   console.log(`  Actual: ${f.actualValue}`);
 * });
 */
