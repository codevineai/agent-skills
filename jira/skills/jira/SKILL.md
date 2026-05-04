---
name: jira
description: Query and manage Jira issues - search, create, bulk create, update, comment, link, transition status, and look up users.
---

# Jira Skill

Query and manage Jira issues directly from Claude Code.

## Setup

Create `~/.jira/credentials`:

```ini
JIRA_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=you@example.com
JIRA_API_KEY=your-api-token
```

Get your API token from: https://id.atlassian.com/manage-profile/security/api-tokens

## Before You Start

Read only the type files relevant to your task:
- **Searching/viewing issues?** Read `types/issues.d.ts`
- **Listing projects?** Read `types/projects.d.ts`
- **Looking up users?** Read `types/users.d.ts`
- **Finding custom fields?** Read `types/fields.d.ts`

## Usage

Simple query:

```bash
node ${CLAUDE_SKILL_DIR}/jira_api.js <<'EOF'
const result = await jira.issues.search('assignee = currentUser() ORDER BY updated DESC', { maxResults: 5 });
for (const issue of result.issues) {
  console.log(`${issue.key}: ${issue.fields.summary}`);
}
EOF
```

Multiple operations in one execution:

```bash
node ${CLAUDE_SKILL_DIR}/jira_api.js <<'EOF'
// Get all high-priority bugs assigned to me that are still open
const result = await jira.issues.search(
  'assignee = currentUser() AND type = Bug AND priority = High AND status != Done'
);

for (const issue of result.issues) {
  // Get available transitions for each issue
  const { transitions } = await jira.issues.getTransitions(issue.key);
  const inProgress = transitions.find(t => t.name === 'In Progress');

  console.log(`${issue.key}: ${issue.fields.summary}`);
  console.log(`  Status: ${issue.fields.status.name}`);
  console.log(`  Can transition to In Progress: ${inProgress ? 'yes' : 'no'}`);
  console.log('');
}
EOF
```

## Quick Reference

### Create Issue

```javascript
const result = await jira.issues.create({
  project: { key: 'PROJ' },
  issuetype: { name: 'Task' },
  summary: 'My new task',
  priority: { name: 'High' },
  labels: ['backend']
});
console.log(result.key);  // 'PROJ-456'
```

### Create Issue Under an Epic

```javascript
await jira.issues.create({
  project: { key: 'PROJ' },
  issuetype: { name: 'Task' },
  summary: 'Task under epic',
  parent: { key: 'PROJ-100' }
});
```

### Bulk Create Issues

```javascript
const result = await jira.issues.createBulk([
  { fields: { project: { key: 'PROJ' }, issuetype: { name: 'Task' }, summary: 'Task 1' } },
  { fields: { project: { key: 'PROJ' }, issuetype: { name: 'Task' }, summary: 'Task 2' } },
  { fields: { project: { key: 'PROJ' }, issuetype: { name: 'Task' }, summary: 'Task 3' } }
]);
for (const issue of result.issues) console.log(issue.key);
```

### List Projects

```javascript
const result = await jira.projects.list();
for (const p of result.values) {
  console.log(`${p.key}: ${p.name}`);
}
```

### Search Issues (JQL)

```javascript
const result = await jira.issues.search('project = PROJ AND status != Done ORDER BY updated DESC');
for (const issue of result.issues) {
  console.log(`${issue.key}: ${issue.fields.summary} [${issue.fields.status.name}]`);
}
```

Common JQL:
- `assignee = currentUser()` - Your issues
- `project = PROJ` - All in project
- `status = "In Progress"` - By status
- `type = Bug AND priority = High` - Filter combos
- `updated >= -7d` - Recent activity

### Get Issue Details

```javascript
const issue = await jira.issues.get('PROJ-123');
console.log(JSON.stringify(issue.fields, null, 2));
```

### Update Issue

```javascript
await jira.issues.update('PROJ-123', {
  summary: 'Updated title',
  priority: { name: 'High' },
  labels: ['backend', 'urgent']
});
```

### Add Label (without replacing)

```javascript
await jira.issues.updateWithOperations('PROJ-123', {
  labels: [{ add: 'needs-review' }]
});
```

### Assign Issue

```javascript
const users = await jira.users.assignable('PROJ', { query: 'john' });
if (users.length > 0) {
  await jira.issues.update('PROJ-123', {
    assignee: { accountId: users[0].accountId }
  });
}
```

### Transition Issue

```javascript
const { transitions } = await jira.issues.getTransitions('PROJ-123');
const done = transitions.find(t => t.name === 'Done');
if (done) {
  await jira.issues.transition('PROJ-123', done.id);
}
```

### Add Comment

```javascript
await jira.issues.addComment('PROJ-123', 'Plain text comment');
```

### Link Issues

```javascript
// Common link types: "Blocks", "Cloners", "Duplicate", "Relates"
await jira.issues.link('Blocks', 'PROJ-100', 'PROJ-200');
```

### Delete Issue

```javascript
await jira.issues.delete('PROJ-123');
```

### Find Custom Fields

```javascript
const fields = await jira.fields.list();
const custom = fields.filter(f => f.custom);
for (const f of custom) {
  console.log(`${f.id}: ${f.name}`);
}
```

## API Summary

| API | Methods |
|-----|---------|
| `jira.projects` | `list(options?)`, `get(key, options?)` |
| `jira.issues` | `create(fields)`, `createBulk(issues)`, `search(jql, options?)`, `get(key, options?)`, `update(key, fields)`, `updateWithOperations(key, ops)`, `delete(key)`, `getTransitions(key)`, `transition(key, id, fields?)`, `getEditMeta(key)`, `addComment(key, body)`, `getComments(key, options?)`, `link(type, inwardKey, outwardKey)` |
| `jira.users` | `search(query, options?)`, `assignable(project, options?)` |
| `jira.fields` | `list()` |
