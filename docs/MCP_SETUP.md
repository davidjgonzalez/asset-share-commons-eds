# MCP Setup — AEM Document Authoring

This document covers the Document Authoring (DA) MCP server available in Claude Code sessions
for this project. It lets you read and write authored content (pages, fragments) that lives in
`da.live` without manually copying markdown.

---

## What the DA MCP is

The DA MCP is a remote content API that wraps `da.live` — the Document Authoring service that
stores page content for AEM Edge Delivery Services sites. With it, an agent can:

- List, read, create, update, and delete content documents
- Move or copy content trees
- Upload media binaries
- Resolve fragment and media references
- Read version history

**Key distinction:** Use the DA MCP for *authored content* (pages, fragments living in `da.live`).
Use *local file edits* for *code* (blocks, styles, scripts in this repo). Do not mix the two.

---

## Authentication

Before calling any DA MCP tool in a fresh session, run the DA auth skill:

```
/da-auth
```

or invoke it as:

```
aem-edge-delivery-services:da-auth
```

This skill walks you through the OAuth flow (opens a browser tab, waits for the token, then
stores it for the session). Every DA MCP tool call will silently 401 if you skip this step.

You only need to authenticate once per session — the token is reused across all subsequent
DA MCP calls.

---

## Available tools

All DA MCP tools are prefixed `mcp__aem-da__` in Claude Code. The `mcp__claude_ai_AEM_DA_-_Prod__`
variants are equivalent (different MCP server registration name).

| Tool | Purpose |
|------|---------|
| `da_list_sources` | List content at a path (directory listing) |
| `da_get_source` | Read a document's raw markdown or HTML |
| `da_create_source` | Create a new document |
| `da_update_source` | Update an existing document |
| `da_delete_source` | Delete a source document |
| `da_move_content` | Move content (rename or relocate) |
| `da_copy_content` | Copy content to a new path |
| `da_upload_media` | Upload a binary asset (image, etc.) |
| `da_lookup_fragment` | Resolve a fragment reference to its source |
| `da_lookup_media` | Resolve a media reference to its delivery URL |
| `da_get_versions` | List version history for a document |

---

## Common usage pattern

The `aem-edge-delivery-services:da-content` skill is the recommended entry point when you need
to read or write authored content. It handles path resolution, encoding, and error handling on
top of the raw DA MCP tools.

Typical flow:

```
# 1. Authenticate (once per session)
/da-auth

# 2. Use the da-content skill for guided content operations
aem-edge-delivery-services:da-content
```

For direct tool use (e.g. inside an agent prompt), call the tools directly after authenticating:

```js
// Read a page
da_get_source({ path: '/my-org/my-repo/en/search' })

// Update a page
da_update_source({ path: '/my-org/my-repo/en/search', content: '...' })

// List a folder
da_list_sources({ path: '/my-org/my-repo/en' })
```

---

## When to use DA MCP vs local file edits

| Task | Use |
|------|-----|
| Edit a page's content, headings, or block table rows | DA MCP (`da_update_source`) |
| Create a new content page or fragment | DA MCP (`da_create_source`) |
| Edit block JavaScript or CSS | Local file edit (`Edit` tool) |
| Edit `styles/`, `scripts/`, or `blocks/` source | Local file edit |
| Edit `CLAUDE.md`, `AGENTS.md`, or `docs/` | Local file edit |
| Upload a new image to the site | DA MCP (`da_upload_media`) |
| Inspect what content is at a path in da.live | DA MCP (`da_list_sources` / `da_get_source`) |

---

## Path conventions

DA paths follow the pattern: `/{org}/{repo}/{locale}/{page-path}`

Example: `/adobe/asset-share-commons-eds/en/search`

The `org` and `repo` segments match the GitHub org and repo name. The locale segment (`en`)
matches the first path segment of the live site.
