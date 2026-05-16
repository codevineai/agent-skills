---
name: confluence
description: Search, read, and create Confluence pages. Search with CQL, browse spaces, get page content, manage child pages, and create documentation.
---

# Confluence Skill

Search, read, and create Confluence documentation directly from Claude Code.

## Setup

Create `~/.confluence/credentials`:

```ini
CONFLUENCE_URL=https://yourcompany.atlassian.net/wiki
CONFLUENCE_EMAIL=you@example.com
CONFLUENCE_API_KEY=your-api-token
```

Get your API token from: https://id.atlassian.com/manage-profile/security/api-tokens

## Before You Start

Read only the type files relevant to your task:
- **Searching/reading pages?** Read `types/content.d.ts`
- **Listing spaces?** Read `types/spaces.d.ts`
- **Advanced search with excerpts?** Read `types/search.d.ts`

## Usage

Simple search:

```bash
node ${CLAUDE_SKILL_DIR}/confluence_api.js <<'EOF'
const results = await confluence.content.search('text ~ "authentication"');
for (const page of results.results) {
  console.log(`${page.title} (${page.space.name})`);
  console.log(`  ${page._links.webui}`);
}
EOF
```

Search with full content:

```bash
node ${CLAUDE_SKILL_DIR}/confluence_api.js <<'EOF'
const results = await confluence.content.search(
  'text ~ "api" AND space = DEV',
  { expand: 'body.storage', limit: 5 }
);

for (const page of results.results) {
  console.log(`\n## ${page.title}`);
  console.log(`Space: ${page.space.name}`);
  if (page.body?.storage) {
    console.log(`Content length: ${page.body.storage.value.length} characters`);
  }
}
EOF
```

## Quick Reference

### Search All Spaces

```javascript
const results = await confluence.content.search('text ~ "docker"');
for (const page of results.results) {
  console.log(`${page.title} - ${page.space.name}`);
}
```

Common CQL patterns:
- `text ~ "keyword"` - Full-text search
- `title ~ "keyword"` - Search titles only
- `text ~ "auth*"` - Wildcards
- `space = DEV` - Filter by space
- `type = page` - Pages only (vs blogposts, comments)
- `created >= "2024-01-01"` - Date filters
- `label = "api"` - Filter by label

### Search with Excerpts

```javascript
const results = await confluence.search.cql(
  'text ~ "troubleshooting" AND space IN (DEV, OPS)',
  { excerpt: 'highlight', limit: 10 }
);

for (const result of results.results) {
  console.log(`${result.title}`);
  console.log(`  Space: ${result.content.space.name}`);
  if (result.excerpt) console.log(`  ${result.excerpt}`);
}
```

### Get Page with Content

```javascript
const page = await confluence.content.get('123456', {
  expand: 'body.storage,version'
});
console.log(page.title);
console.log(page.body.storage.value); // HTML content
```

### List Spaces

```javascript
const spaces = await confluence.spaces.list();
for (const space of spaces.results) {
  console.log(`${space.key}: ${space.name}`);
}
```

### List Pages in a Space

```javascript
const pages = await confluence.content.getBySpace('DEV', { limit: 50 });
for (const page of pages.results) {
  console.log(page.title);
}
```

### Get Child Pages

```javascript
const children = await confluence.content.getChildren('123456');
for (const child of children.results) {
  console.log(`- ${child.title}`);
}
```

### Get Page Comments

```javascript
const comments = await confluence.content.getComments('123456');
for (const comment of comments.results) {
  const author = comment.version.by.displayName;
  const text = comment.body.storage.value.replace(/<[^>]*>/g, '').trim();
  console.log(`${author}: ${text}`);
}
```

### Preview Before Creating

```javascript
const data = {
  type: 'page',
  title: 'My New Page',
  space: { key: 'DEV' },
  body: { storage: { value: '<p>Content here</p>', representation: 'storage' } }
};
await confluence.content.preview(data);  // Shows details, no write
```

### Create a Page

```javascript
const result = await confluence.content.create({
  type: 'page',
  title: 'API Documentation',
  space: { key: 'DEV' },
  body: {
    storage: {
      value: '<h2>Overview</h2><p>Content here...</p>',
      representation: 'storage'
    }
  }
});
console.log('Created:', result._links.webui);
```

### Create a Child Page

```javascript
const result = await confluence.content.create({
  type: 'page',
  title: 'Sub-Page',
  space: { key: 'DEV' },
  ancestors: [{ id: '123456' }],  // Parent page ID
  body: {
    storage: {
      value: '<p>Child page content</p>',
      representation: 'storage'
    }
  }
});
```

### Update a Page

```javascript
// Always get current version first
const current = await confluence.content.get('123456');
await confluence.content.update('123456', {
  type: 'page',
  title: current.title,
  version: { number: current.version.number + 1 },
  body: {
    storage: {
      value: '<h2>Updated Content</h2><p>New text</p>',
      representation: 'storage'
    }
  }
});
```

### Get Your Personal Space

```javascript
const space = await confluence.user.getPersonalSpace();
console.log(`Your space: ${space.name} (${space.key})`);
```

### Find Recently Updated Pages

```javascript
const results = await confluence.search.cql(
  'space = DEV AND type = page ORDER BY lastModified DESC',
  { limit: 20 }
);
```

## API Summary

| API | Methods |
|-----|---------|
| `confluence.content` | `search(cql, options?)`, `get(id, options?)`, `getBySpace(spaceKey, options?)`, `getChildren(id, options?)`, `getDescendants(id, options?)`, `getComments(id, options?)`, `preview(data)`, `create(data)`, `update(id, data)`, `delete(id)` |
| `confluence.spaces` | `list(options?)`, `get(key, options?)` |
| `confluence.search` | `cql(query, options?)` |
| `confluence.user` | `getCurrent(options?)`, `getPersonalSpace()` |
