---
name: codevine-mcp-stdio
description: Documentation for the CodeVine MCP stdio server plugin. Do not invoke this skill — it exists only to explain the plugin.
---

# CodeVine MCP Server (stdio)

This plugin registers a local MCP server that exposes CodeVine data to any client that supports MCP but does **not** support Claude Code skills/plugins.

## When to use this plugin

Install this plugin if your coding agent **cannot** run skills (JavaScript files invoked via Bash). Examples:

- Claude Desktop
- Cursor
- Windsurf
- Other MCP-compatible editors

## When NOT to use this plugin

**Do not install this plugin in Claude Code.** Claude Code agents already have access to the `codevine` skill, which provides the same capabilities (and more) without an MCP server. Enabling both creates redundant tool registrations and slower tool discovery.

## What it provides

The MCP server exposes these read-only tools:

| Tool | Description |
|------|-------------|
| `list_sessions` | List chat sessions with filters (scope, user, repo, search) |
| `get_session` | Get a single session by ID |
| `get_session_messages` | Get message blocks for a session from the gateway |
| `list_projects` | List projects with filters |
| `get_project` | Get project details |
| `list_project_members` | List members of a project |
| `list_all_project_members` | List all project members across projects |
| `get_project_costs` | Get cost breakdown for a project |
| `list_users` | List users in the tenant |
| `list_plugins` | List available plugins |
| `get_plugin` | Get plugin details and files |
| `list_report_views` | List available reporting views |
| `describe_report_view` | Get column schema for a reporting view |
| `query_reports` | Execute read-only SQL against reporting views |
| `get_me` | Get current authenticated user info |

## Prerequisites

Run `codevineai setup` first. The MCP server reads credentials from `~/.codevineai/credentials`.

## How it works

The plugin's `.mcp.json` launches `node ~/.codevineai/scripts/api.js mcp`, which starts a JSON-RPC 2.0 server over stdin/stdout. The agent communicates with it using the standard MCP stdio transport.
