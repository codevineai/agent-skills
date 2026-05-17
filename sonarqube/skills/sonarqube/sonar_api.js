#!/usr/bin/env node
/**
 * SonarQube API Skill
 *
 * Provides access to SonarQube REST API for code quality analysis.
 * Handles credential discovery from environment variables or INI files.
 *
 * Usage:
 *   echo "await api.projects.search()" | ./sonar_api.js
 *   echo "const qg = await api.qualityGates.getStatus('my-project'); console.log(qg)" | ./sonar_api.js
 */

import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PLATFORM = 'sonarqube';
const CREDENTIAL_KEYS = ['SONARQUBE_URL', 'SONARQUBE_TOKEN'];

// ============================================================================
// CREDENTIALS HELPER (included inline for self-contained skills)
// ============================================================================

function parseIniFile(content) {
  const profiles = {};
  let currentProfile = 'default';

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) continue;

    const profileMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (profileMatch) {
      currentProfile = profileMatch[1].trim();
      if (!profiles[currentProfile]) profiles[currentProfile] = {};
      continue;
    }

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!profiles[currentProfile]) profiles[currentProfile] = {};
      profiles[currentProfile][key] = value;
    }
  }
  return profiles;
}

function loadCredentialsFile(platform) {
  const paths = [
    join(process.cwd(), `.${platform}`, 'credentials'),
    join(homedir(), `.${platform}`, 'credentials')
  ];

  for (const path of paths) {
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, 'utf-8');
        return { profiles: parseIniFile(content), path };
      } catch (e) { /* Continue */ }
    }
  }
  return { profiles: {}, path: null };
}

function getCredentials(platform, keys) {
  const values = {};
  const missing = [];

  const profile = process.env.SONARQUBE_PROFILE || 'default';
  const { profiles, path: credsPath } = loadCredentialsFile(platform);
  const profileData = profiles[profile] || {};

  for (const key of keys) {
    if (process.env[key]) {
      values[key] = process.env[key];
      continue;
    }
    if (profileData[key]) {
      values[key] = profileData[key];
      continue;
    }
    if (profile !== 'default' && profiles['default']?.[key]) {
      values[key] = profiles['default'][key];
      continue;
    }
    missing.push(key);
  }

  if (missing.length > 0) {
    const exampleKeys = keys.map(k => `${k}=your-value-here`).join('\n');
    let error = `Missing credentials for ${platform}: ${missing.join(', ')}\n\n`;
    error += `Option 1 - Environment variables:\n`;
    for (const key of missing) error += `   export ${key}="..."\n`;
    error += `\nOption 2 - Credentials file (~/.${platform}/credentials):\n`;
    error += `   [default]\n${exampleKeys}\n`;
    error += `\nTo use a profile: export SONARQUBE_PROFILE=work\n`;
    throw new Error(error);
  }

  return values;
}

// ============================================================================
// LOAD CREDENTIALS
// ============================================================================

const creds = getCredentials(PLATFORM, CREDENTIAL_KEYS);
const baseUrl = creds.SONARQUBE_URL.replace(/\/$/, '');
const token = creds.SONARQUBE_TOKEN;

// ============================================================================
// HTTP CLIENT
// ============================================================================

async function request(method, path, body = null, queryParams = null) {
  let url = `${baseUrl}${path}`;

  if (queryParams) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          // Join arrays with comma for SonarQube API
          params.append(key, value.join(','));
        } else {
          params.append(key, String(value));
        }
      }
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const text = await response.text();
    let errorDetail = text;
    try {
      errorDetail = JSON.stringify(JSON.parse(text), null, 2);
    } catch (e) { /* Use raw text */ }
    throw new Error(
      `${method} ${path} failed (${response.status} ${response.statusText}):\n${errorDetail}`
    );
  }

  if (response.status === 204) return null;

  // Handle plain text responses (for sources/raw)
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/plain')) {
    return response.text();
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// ============================================================================
// API OBJECT
// ============================================================================

const api = {
  /**
   * Projects API
   */
  projects: {
    /**
     * Search for projects
     * @param {Object} options
     * @param {number} options.pageSize - Results per page (default: 100, max: 500)
     * @param {number} options.page - Page number (1-based)
     * @param {string} options.query - Search query to filter projects
     * @returns {Promise<Object>} Object with components array and paging info
     */
    search: (options = {}) => request('GET', '/api/projects/search', null, {
      ps: options.pageSize || 100,
      p: options.page || 1,
      q: options.query
    })
  },

  /**
   * Issues API
   */
  issues: {
    /**
     * Search for issues
     * @param {Object} options
     * @param {string[]} options.projects - Project keys
     * @param {string[]} options.severities - BLOCKER, CRITICAL, MAJOR, MINOR, INFO
     * @param {string[]} options.types - BUG, VULNERABILITY, CODE_SMELL, SECURITY_HOTSPOT
     * @param {string[]} options.statuses - OPEN, CONFIRMED, REOPENED, RESOLVED, CLOSED
     * @param {string[]} options.resolutions - FALSE-POSITIVE, WONTFIX, FIXED, REMOVED
     * @param {string} options.branch - Branch name
     * @param {string} options.pullRequest - Pull request ID
     * @param {number} options.pageSize - Results per page (default: 100, max: 500)
     * @param {number} options.page - Page number
     * @returns {Promise<Object>} Object with issues array, paging, and total count
     */
    search: (options = {}) => request('GET', '/api/issues/search', null, {
      projects: options.projects,
      severities: options.severities,
      types: options.types,
      statuses: options.statuses,
      resolutions: options.resolutions,
      branch: options.branch,
      pullRequest: options.pullRequest,
      ps: options.pageSize || 100,
      p: options.page || 1
    })
  },

  /**
   * Quality Gates API
   */
  qualityGates: {
    /**
     * Get quality gate status for a project
     * @param {string} projectKey - Project key
     * @param {Object} options
     * @param {string} options.analysisId - Analysis ID
     * @param {string} options.branch - Branch name
     * @param {string} options.pullRequest - Pull request ID
     * @returns {Promise<Object>} Quality gate status with projectStatus object
     */
    getStatus: (projectKey, options = {}) => request('GET', '/api/qualitygates/project_status', null, {
      projectKey,
      analysisId: options.analysisId,
      branch: options.branch,
      pullRequest: options.pullRequest
    }),

    /**
     * List all quality gates
     * @returns {Promise<Object>} Object with qualitygates array
     */
    list: () => request('GET', '/api/qualitygates/list')
  },

  /**
   * Measures API
   */
  measures: {
    /**
     * Get measures for a component
     * @param {string} componentKey - Component key (project or file)
     * @param {string|string[]} metricKeys - Metric key(s) to retrieve
     * @param {Object} options
     * @param {string} options.branch - Branch name
     * @param {string} options.pullRequest - Pull request ID
     * @returns {Promise<Object>} Object with component and measures array
     */
    get: (componentKey, metricKeys, options = {}) => {
      const metrics = Array.isArray(metricKeys) ? metricKeys.join(',') : metricKeys;
      return request('GET', '/api/measures/component', null, {
        component: componentKey,
        metricKeys: metrics,
        branch: options.branch,
        pullRequest: options.pullRequest
      });
    }
  },

  /**
   * Rules API
   */
  rules: {
    /**
     * Get detailed information about a rule
     * @param {string} ruleKey - Rule key (e.g., 'javascript:S1234')
     * @returns {Promise<Object>} Object with rule details
     */
    get: (ruleKey) => request('GET', '/api/rules/show', null, { key: ruleKey }),

    /**
     * List rule repositories
     * @param {Object} options
     * @param {string} options.language - Language key to filter
     * @param {string} options.query - Search query
     * @returns {Promise<Object>} Object with repositories array
     */
    listRepositories: (options = {}) => request('GET', '/api/rules/repositories', null, {
      language: options.language,
      q: options.query
    })
  },

  /**
   * Sources API
   */
  sources: {
    /**
     * Get raw source code for a file
     * @param {string} fileKey - File key (e.g., 'my_project:src/foo/Bar.js')
     * @param {Object} options
     * @param {string} options.branch - Branch name
     * @param {string} options.pullRequest - Pull request ID
     * @returns {Promise<string>} Raw source code as text
     */
    getRaw: (fileKey, options = {}) => request('GET', '/api/sources/raw', null, {
      key: fileKey,
      branch: options.branch,
      pullRequest: options.pullRequest
    }),

    /**
     * Get SCM information for a file
     * @param {string} fileKey - File key
     * @param {Object} options
     * @param {number} options.from - First line (starts at 1)
     * @param {number} options.to - Last line (inclusive)
     * @param {boolean} options.commitsByLine - Group by commits if false
     * @returns {Promise<Object>} SCM information
     */
    getScm: (fileKey, options = {}) => request('GET', '/api/sources/scm', null, {
      key: fileKey,
      from: options.from,
      to: options.to,
      commits_by_line: options.commitsByLine
    })
  },

  /**
   * System API
   */
  system: {
    /**
     * Get system health status
     * @returns {Promise<Object>} System health (GREEN, YELLOW, RED)
     */
    health: () => request('GET', '/api/system/health'),

    /**
     * Get system status
     * @returns {Promise<Object>} System status with version info
     */
    status: () => request('GET', '/api/system/status')
  },

  /**
   * Languages API
   */
  languages: {
    /**
     * List supported languages
     * @param {Object} options
     * @param {string} options.query - Pattern to match language keys/names
     * @returns {Promise<Object>} Object with languages array
     */
    list: (options = {}) => request('GET', '/api/languages/list', null, {
      q: options.query
    })
  },

  /**
   * Metrics API
   */
  metrics: {
    /**
     * Search for available metrics
     * @param {Object} options
     * @param {number} options.pageSize - Results per page (default: 100, max: 500)
     * @param {number} options.page - Page number
     * @returns {Promise<Object>} Object with metrics array and paging info
     */
    search: (options = {}) => request('GET', '/api/metrics/search', null, {
      ps: options.pageSize || 100,
      p: options.page || 1
    })
  }
};

// ============================================================================
// EXECUTE CODE FROM STDIN
// ============================================================================

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const code = Buffer.concat(chunks).toString('utf-8');

  if (!code.trim()) {
    console.error('No code provided via stdin');
    console.error('\nUsage: echo "await api.projects.search()" | ./sonar_api.js');
    process.exit(1);
  }

  const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
  const fn = new AsyncFunction('api', code);
  const result = await fn(api);

  // Only output result if it's not undefined
  if (result !== undefined) {
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
