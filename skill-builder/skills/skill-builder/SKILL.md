---
name: skill-builder
description: Build API skills for Claude Code using TypeScript interfaces instead of MCP servers. Use this when creating new skills that wrap REST APIs.
---

# Skill Builder

Build API skills for Claude Code using TypeScript interfaces instead of MCP servers.

## Why This Pattern?

| Aspect | MCP Server | Skill + Script |
|--------|------------|----------------|
| Setup | Server process + `.mcp.json` config | Just files |
| Token cost | All tools in context always | Only loaded when skill invoked |
| Flexibility | Fixed tool signatures | Agent writes arbitrary code |
| Discoverability | Tool descriptions | Full TypeScript interfaces with JSDoc |
| Composability | One tool call per operation | Chain operations in one script |
| Debugging | Opaque tool calls | Readable code |
| Security | Agent may need credential access | Script handles creds automatically |

## Skill Structure

Each skill is self-contained with this structure:

```
skills/my-skill/
├── SKILL.md              # Instructions with frontmatter (name, description)
├── my_api.js             # API script with embedded credentials helper
└── types/
    ├── resources.d.ts    # TypeScript interfaces
    └── actions.d.ts
```

## Creating a New Skill

### Step 1: Create the API Script

The API script handles:
1. Credential discovery (env vars → INI file)
2. HTTP client for the API
3. API object with methods
4. Executes JavaScript from stdin

Copy and customize `reference/api-template.js`. The template includes the credentials helper inline - no external dependencies.

Key things to customize:
- Platform name and credential keys (e.g., `jira`, `JIRA_URL`)
- Authentication method (Bearer token, Basic auth, etc.)
- API endpoints and methods

### Step 2: Create TypeScript Interfaces

The `.d.ts` files document your API for the agent. Include:
- Response types with all fields
- Request option types
- API method signatures with `@example` JSDoc

See `reference/types-template.d.ts` for the pattern.

### Step 3: Create SKILL.md

The SKILL.md needs YAML frontmatter and follows progressive disclosure principles.

#### Frontmatter Requirements

```yaml
---
name: my-skill
description: Accesses the Example API for data retrieval and updates. Use this when users need to query, create, or modify example resources.
---
```

**name**: Max 64 characters. Lowercase letters, numbers, and hyphens only. Use gerund form when appropriate (e.g., `processing-pdfs`).

**description**: Max 1024 characters. Write in third person. Include both:
- What it does (capabilities)
- When to use it (triggers for the agent)

#### Progressive Disclosure

Keep SKILL.md under 500 lines as an overview. Put detailed content in separate files:

```
my-skill/
├── SKILL.md           # Overview, setup, quick reference (~100-200 lines)
├── my_api.js
└── types/
    ├── resources.d.ts # Agent reads these for detailed API info
    └── actions.d.ts
```

The agent reads SKILL.md first, then reads type files as needed for the specific task.

#### Structure Template

```markdown
---
name: my-skill
description: [What it does]. Use this when [trigger conditions].
---

# My Skill Title

Brief overview of capabilities.

## Setup

How to configure credentials (link to credentials file location).

## Before You Start

Direct agent to read specific type files based on their task:
- Working with resources? Read `types/resources.d.ts`
- Performing actions? Read `types/actions.d.ts`

## Usage

Show the heredoc execution pattern.

## Quick Reference

2-3 common examples to get started.

## API Summary

Table of available methods (brief - details are in type files).
```

## Credentials System

Skills use INI-style credentials files (like AWS):

### File Location

The script looks for credentials in order:
1. Environment variables (highest priority)
2. `./<platform>/credentials` (working directory)
3. `~/.<platform>/credentials` (home directory)

### File Format

```ini
[default]
PLATFORM_URL=https://api.example.com
PLATFORM_API_KEY=your-api-key

[work]
PLATFORM_URL=https://work.example.com
PLATFORM_API_KEY=work-api-key
```

Or without a header (treated as `[default]`):

```ini
PLATFORM_URL=https://api.example.com
PLATFORM_API_KEY=your-api-key
```

### Profile Selection

Set `MYPLATFORM_PROFILE` to use a different profile:

```bash
export MYPLATFORM_PROFILE=work
```

## Reference Files

- `reference/api-template.js` - Complete API script template with credentials
- `reference/types-template.d.ts` - TypeScript interface template
- [Jira skill](https://github.com/codevineai/agent-skills/tree/main/jira/skills/jira) - Complete working example (GitHub)

## When to Use This Pattern

**Good fit:**
- REST API access
- Complex queries needing loops, conditionals, composition
- Rich type information helps the agent
- Sensitive credentials you don't want in agent context

**Use MCP instead for:**
- Stateful connections (WebSockets)
- External CLIs that aren't easily scriptable
- OAuth flows with interactive auth

## Publishing to CodeVine

Once your skill is ready, use the `/codevine` skill to publish it as a plugin.
