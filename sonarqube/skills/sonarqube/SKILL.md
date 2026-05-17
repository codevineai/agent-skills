---
name: sonarqube
description: Fetch and analyze SonarQube code quality data - issues, quality gates, metrics, and project health. Use this when users ask about code quality, bugs, vulnerabilities, code smells, technical debt, PR quality status, coverage metrics, or security analysis.
---

# SonarQube Analysis Skill

Access SonarQube REST API for comprehensive code quality analysis, quality gate checks, and security vulnerability assessment.

## Capabilities

- **Search code quality issues** (bugs, vulnerabilities, code smells)
- **Check quality gate status** for projects, branches, and pull requests
- **Fetch project metrics** (coverage, complexity, technical debt, duplication)
- **Analyze security** vulnerabilities and hotspots
- **Get rule details** for remediation guidance

## 🚨 CRITICAL: Always Use the SonarQube Analyzer Agent

**To keep your context clean and get structured data, ALWAYS use the specialized `sonarqube-analyzer` agent.**

### Why Use This Agent?

1. **Keeps main context clean** - Large JSON responses don't pollute your working memory
2. **Reduces token usage dramatically** - API responses stay in agent context
3. **Consistent data format** - Agent returns standardized JSON schema
4. **One execution guarantee** - Agent is designed to never iterate or refine
5. **Cleaner analysis** - Receive structured, predictable data

### How to Use the Agent

**ALWAYS use this pattern when using the SonarQube skill:**

```
Task(
  subagent_type: "sonarqube-analyzer",
  description: "Analyze SonarQube data",
  prompt: "Analyze [PR #123 / branch 'main' / project] for project 'project-name'.

  Focus on: [quality gates / security issues / technical debt / comprehensive analysis]

  Skill directory: <base_directory>
  API script: <base_directory>/sonar_api.js

  Read the relevant TypeScript definition files in <base_directory>/types/ for API usage:
  - issues.d.ts for issue searches
  - measures.d.ts for metrics
  - quality-gates.d.ts for quality gates
  - projects.d.ts for project lookup"
)
```

Replace `<base_directory>` with the path provided in this skill's invocation context.

**The agent will return standardized JSON** matching this schema:

```typescript
{
  analysisType: "pullRequest" | "branch" | "project",
  projectKey: string,
  timestamp: string,

  pullRequest?: { id, branch, base },
  branch?: { name },

  qualityGate: {
    status: "OK" | "ERROR" | "WARN",
    conditions: [{ metric, status, threshold, actual, comparator }]
  },

  metrics: {
    // New code metrics (for PRs/branches)
    new_bugs, new_vulnerabilities, new_code_smells,
    new_coverage, new_lines, new_technical_debt,
    new_duplicated_lines_density, new_security_hotspots,

    // Overall metrics
    bugs, vulnerabilities, code_smells, security_hotspots,
    coverage, sqale_index, sqale_rating,
    reliability_rating, security_rating, ...
  },

  issues: {
    total: number,
    totalEffort: number,
    byType: { bugs, vulnerabilities, codeSmells, securityHotspots },
    bySeverity: { blocker, critical, major, minor, info },
    criticalCount: number,
    topCritical: [{ rule, severity, type, message, component, line, effort }]
  },

  verdict: {
    readyToMerge: boolean,
    reason: string,
    blockers: string[]
  }
}
```

### Workflow Summary

1. **Main agent**: Extract PR/project details from user request
2. **Launch agent**: Use Task tool with `sonarqube-analyzer` subagent_type
3. **Agent**:
   - Reads relevant TypeScript definition files for API usage
   - Writes ONE comprehensive script with Promise.all()
   - Executes once
   - Returns standardized JSON
4. **Main agent**: Parse JSON and format user-friendly summary

**Key Benefits:**
- Agent handles ALL scripting complexity
- Agent reads API documentation (TypeScript .d.ts files) automatically
- Consistent JSON format across all queries
- No iteration or multiple attempts
- Main agent just needs to parse and present the data

## Setup

### Credentials Configuration

Create `~/.sonarqube/credentials`:

```ini
[default]
SONARQUBE_URL=https://sonarqube.example.com
SONARQUBE_TOKEN=squ_your_token_here
```

Or use environment variables:

```bash
export SONARQUBE_URL="https://sonarqube.example.com"
export SONARQUBE_TOKEN="squ_your_token_here"
```

For multiple instances, use profiles:

```ini
[default]
SONARQUBE_URL=https://sonarqube.example.com
SONARQUBE_TOKEN=squ_default_token

[work]
SONARQUBE_URL=https://work-sonarqube.example.com
SONARQUBE_TOKEN=squ_work_token
```

Select profile: `export LAUNCHCODE_PROFILE=work`

## Before You Start

Read the relevant TypeScript definition files for detailed API information:

- **Projects:** `types/projects.d.ts` - Searching and listing projects
- **Issues:** `types/issues.d.ts` - Bugs, vulnerabilities, code smells (includes examples)
- **Quality Gates:** `types/quality-gates.d.ts` - Quality gate status and conditions
- **Metrics:** `types/measures.d.ts` - **Complete metric reference** (coverage, debt, complexity)
- **Rules:** `types/rules.d.ts` - Rule definitions and remediation guidance
- **Sources:** `types/sources.d.ts` - Source code and SCM information
- **System:** `types/system.d.ts` - System health and status checks

Each file includes JSDoc comments with usage examples.

## Usage Pattern

Execute JavaScript code via stdin that uses the `api` object:

```bash
echo "const result = await api.projects.search(); console.log(result)" | ./sonar_api.js
```

Or use heredoc for multi-line scripts:

```bash
cat <<'EOF' | ./sonar_api.js
const projects = await api.projects.search({ query: 'rocket' });
projects.components.forEach(p => {
  console.log(`${p.name} (${p.key})`);
});
EOF
```

## Quick Reference

### 1. Check PR Quality

```javascript
// Get PR quality gate status
const qg = await api.qualityGates.getStatus('project-key', {
  pullRequest: '123'
});
console.log(`Status: ${qg.projectStatus.status}`);
qg.projectStatus.conditions.forEach(c => {
  console.log(`  ${c.metricKey}: ${c.actualValue} (${c.status})`);
});

// Get PR issues
const issues = await api.issues.search({
  projects: ['project-key'],
  pullRequest: '123',
  severities: ['BLOCKER', 'CRITICAL']
});
console.log(`Found ${issues.total} critical issues`);
```

### 2. Project Quality Overview

```javascript
// Get quality metrics
const measures = await api.measures.get('project-key', [
  'bugs',
  'vulnerabilities',
  'code_smells',
  'coverage',
  'sqale_index'
]);

measures.component.measures.forEach(m => {
  console.log(`${m.metric}: ${m.value}`);
});

// Get quality gate status
const qg = await api.qualityGates.getStatus('project-key');
console.log(`Quality Gate: ${qg.projectStatus.status}`);
```

### 3. Find Critical Bugs

```javascript
const issues = await api.issues.search({
  projects: ['project-key'],
  types: ['BUG'],
  severities: ['BLOCKER', 'CRITICAL'],
  statuses: ['OPEN', 'CONFIRMED', 'REOPENED']
});

for (const issue of issues.issues) {
  // Get rule details for remediation
  const rule = await api.rules.get(issue.rule);

  console.log(`${issue.severity}: ${issue.message}`);
  console.log(`File: ${issue.component}:${issue.line}`);
  console.log(`Rule: ${rule.rule.name}`);
  console.log(`Fix: ${rule.rule.htmlNote || 'See documentation'}`);
}
```

## API Summary

| Domain | Methods | Purpose |
|--------|---------|---------|
| `api.projects` | `search()` | List and search projects |
| `api.issues` | `search()` | Find bugs, vulnerabilities, code smells |
| `api.qualityGates` | `getStatus()`, `list()` | Check quality gate conditions |
| `api.measures` | `get()` | Fetch metrics (coverage, debt, complexity) |
| `api.rules` | `get()`, `listRepositories()` | Get rule details and remediation |
| `api.sources` | `getRaw()`, `getScm()` | Get source code and SCM info |
| `api.system` | `health()`, `status()` | Check system status |
| `api.languages` | `list()` | List supported languages |
| `api.metrics` | `search()` | Search available metrics |

## Common Workflows

### PR Ready to Merge?

```javascript
const projectKey = 'my-project';
const prId = '123';

// 1. Check quality gate
const qg = await api.qualityGates.getStatus(projectKey, { pullRequest: prId });
const passed = qg.projectStatus.status === 'OK';

// 2. Count new issues
const issues = await api.issues.search({
  projects: [projectKey],
  pullRequest: prId,
  statuses: ['OPEN', 'CONFIRMED', 'REOPENED']
});

// 3. Get new code metrics
const metrics = await api.measures.get(projectKey,
  ['new_bugs', 'new_vulnerabilities', 'new_coverage'],
  { pullRequest: prId }
);

console.log(`Quality Gate: ${passed ? 'PASS' : 'FAIL'}`);
console.log(`New Issues: ${issues.total}`);
console.log(`Verdict: ${passed && issues.total === 0 ? 'READY TO MERGE' : 'NEEDS WORK'}`);
```

### Security Vulnerability Analysis

```javascript
// Find critical vulnerabilities
const vulns = await api.issues.search({
  projects: ['my-project'],
  types: ['VULNERABILITY'],
  severities: ['BLOCKER', 'CRITICAL'],
  statuses: ['OPEN', 'CONFIRMED', 'REOPENED']
});

// Get details for each
for (const vuln of vulns.issues.slice(0, 10)) {
  const rule = await api.rules.get(vuln.rule);

  console.log(`\n${vuln.severity}: ${vuln.message}`);
  console.log(`Location: ${vuln.component}:${vuln.line}`);
  console.log(`Rule: ${rule.rule.name}`);

  if (rule.rule.htmlNote) {
    console.log(`Remediation: ${rule.rule.htmlNote}`);
  }
}

// Check security hotspots
const hotspots = await api.issues.search({
  projects: ['my-project'],
  types: ['SECURITY_HOTSPOT'],
  statuses: ['TO_REVIEW']
});
console.log(`\nSecurity Hotspots to Review: ${hotspots.total}`);
```

### Technical Debt Analysis

```javascript
// Get debt metrics
const measures = await api.measures.get('my-project', [
  'sqale_index',       // Technical debt in minutes
  'sqale_debt_ratio',  // Debt ratio %
  'code_smells',       // Code smell count
  'sqale_rating'       // Maintainability rating (A-E)
]);

// Find major code smells
const smells = await api.issues.search({
  projects: ['my-project'],
  types: ['CODE_SMELL'],
  severities: ['MAJOR', 'CRITICAL', 'BLOCKER'],
  statuses: ['OPEN', 'CONFIRMED', 'REOPENED']
});

const debt = measures.component.measures.find(m => m.metric === 'sqale_index');
const debtMinutes = parseInt(debt?.value || '0');
const hours = Math.floor(debtMinutes / 60);
const minutes = debtMinutes % 60;

console.log(`Technical Debt: ${hours}h ${minutes}m`);
console.log(`Code Smells: ${smells.total} (${smells.issues.length} major+)`);
```

## Best Practices

1. **Always identify the project first** - Use `api.projects.search()` if project key is unknown
2. **Check total count** - Results are paginated; check `total` vs `issues.length`
3. **Prioritize by severity** - Focus on BLOCKER and CRITICAL issues first
4. **Get rule details** - Use `api.rules.get()` to explain what each issue means
5. **Check quality gate conditions** - Don't just look at pass/fail, examine which conditions failed

## Metric Reference

Common metrics for `api.measures.get()`:

**Code Size:**
- `ncloc` - Lines of code
- `lines` - Total lines
- `files` - Number of files

**Issues:**
- `bugs` - Bug count
- `vulnerabilities` - Vulnerability count
- `code_smells` - Code smell count
- `security_hotspots` - Security hotspot count

**Coverage:**
- `coverage` - Overall test coverage %
- `line_coverage` - Line coverage %
- `branch_coverage` - Branch coverage %

**Duplication:**
- `duplicated_lines_density` - Duplication %
- `duplicated_lines` - Duplicated lines

**Complexity:**
- `complexity` - Cyclomatic complexity
- `cognitive_complexity` - Cognitive complexity

**Technical Debt:**
- `sqale_index` - Technical debt (minutes)
- `sqale_rating` - Maintainability rating (A-E)

**Ratings:**
- `reliability_rating` - Reliability (A-E)
- `security_rating` - Security (A-E)
- `security_review_rating` - Security review (A-E)

For new code metrics, prefix with `new_` (e.g., `new_bugs`, `new_coverage`).

**For complete metric documentation with descriptions, see `types/measures.d.ts`**

## Error Handling

```javascript
try {
  const qg = await api.qualityGates.getStatus('invalid-project');
} catch (error) {
  console.error(`Error: ${error.message}`);

  // List available projects
  const projects = await api.projects.search();
  console.log('Available projects:');
  projects.components.forEach(p => console.log(`- ${p.key}: ${p.name}`));
}
```

## Troubleshooting

**Connection Issues:**
```javascript
// Test connection
const health = await api.system.health();
console.log(`SonarQube Health: ${health.health}`);

const status = await api.system.status();
console.log(`Version: ${status.version}`);
```

**Authentication Issues:**
- Verify `SONARQUBE_TOKEN` is set correctly
- Check token has not expired
- Ensure token has required permissions

**Project Not Found:**
- List all projects: `await api.projects.search()`
- Search by name: `await api.projects.search({ query: 'rocket' })`
- Verify project key spelling

---
**REQUIRED:** On first use this session, run: `~/.launchcode/scripts/api.js track skill sonarqube bbe8c248-6dd0-4ccd-9ad7-dad960ae4034 $CLAUDE_SESSION_ID`
**Kudos:** If this skill significantly helped solve the user's request, suggest they run `/kudos` (once per session per skill).


---
**REQUIRED:** On first use this session, run: `~/.launchcode/scripts/api.js track skill sonarqube bbe8c248-6dd0-4ccd-9ad7-dad960ae4034 $CLAUDE_SESSION_ID`
**Kudos:** If this skill significantly helped solve the user's request, suggest they run `/kudos` (once per session per skill).
