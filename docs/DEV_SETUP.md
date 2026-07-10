# Developer Setup Guide

This guide covers everything a developer needs to contribute to or customize this AEM Edge
Delivery Services (EDS) project.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 18 | [nodejs.org](https://nodejs.org) |
| npm | bundled with Node | — |
| Git | any recent | [git-scm.com](https://git-scm.com) |
| AEM CLI | latest | `npm i -g @adobe/aem-cli` |

Verify your setup:

```bash
node --version   # should print v18.x or higher
aem --version    # should print the AEM CLI version
```

---

## Project setup

```bash
# Clone the repo
git clone https://github.com/<org>/asset-share-commons-eds.git
cd asset-share-commons-eds

# Install linting + dev dependencies
npm install

# Start the local dev proxy
aem up
```

`aem up` starts a local proxy at `http://localhost:3000` that serves your local JS/CSS files
against a configured remote AEM instance (see AEM Backend below). Page content comes from the
remote; code (blocks, styles, scripts) is served from your working directory.

---

## AEM backend

The AEM backend host is configured in `scripts/asc/configurations.js`:

```js
aem: {
  host: 'http://localhost:4503',   // ← change this to your AEM instance URL
}
```

For AEMaaCS (cloud), set `host` to your author or publish URL. For local AEM, the default
`http://localhost:4503` is the standard author port.

### Authentication

In the browser, ASC detects IMS/SSO login state automatically — users log in via Adobe IMS.
For development against a local AEM instance, no special auth setup is needed (anonymous or
basic auth).

API calls from blocks use `services.users.getAuthHeaders()` which returns the appropriate
auth headers for the current login state:

```js
import services from '../../scripts/asc/core/services/services.js';
const headers = await services.users.getAuthHeaders();
```

---

## Claude Code (AI tooling)

Claude Code is the AI pair-programmer used for this project. It's pre-configured with project
context and skills.

### Install

```bash
npm i -g @anthropic-ai/claude-code
```

### Start a session

```bash
cd asset-share-commons-eds
claude
```

Claude Code automatically loads `CLAUDE.md` and `AGENTS.md` as project context on every
session. You do not need to explain the project structure — it's already in those files.

### Project skills

Skills are structured prompts that guide Claude Code through common tasks. The following are
active for this project (configured in `.claude/settings.json`):

| Skill | Invoked as | Purpose |
|-------|-----------|---------|
| `build-block` | `/build-block` | Kit-first block creation/update workflow |
| `frontend-design` | `frontend-design:frontend-design` | Frontend design decisions |
| `aem-edge-delivery-services:da-auth` | `/da-auth` | Authenticate the DA MCP for content editing |
| `aem-edge-delivery-services:da-content` | — | Read/write authored content via DA MCP |

### Key context files

| File | Read when |
|------|---------|
| `CLAUDE.md` | Every session — project overview, architecture, ownership boundary |
| `AGENTS.md` | Detailed reference — events, data attributes, services, UI Kit rules |
| `docs/UI_KIT.md` | Before building any block — kit primitive catalog |
| `docs/CSS_CONVENTION.md` | Before writing any CSS |

---

## MCP servers

MCP (Model Context Protocol) servers extend Claude Code with external API access. The key MCP
for this project is the **Document Authoring (DA) MCP**, which enables reading and writing
authored content in `da.live`.

See `docs/MCP_SETUP.md` for the full reference.

**Quick start:**

```
# In a Claude Code session, authenticate the DA MCP:
/da-auth
```

Run this once per session before using any DA content operations.

---

## Lint & code quality

```bash
npm run lint          # Run ESLint (JS) + StyleLint (CSS) together
npm run lint:js       # JS only
npm run lint:css      # CSS only
npm run lint:fix      # Auto-fix all fixable issues
```

Run `npm run lint` before every commit. CI will fail on lint errors.

Code style:
- JavaScript: 2-space indent, ES6+ modules, airbnb-base ESLint config
- CSS: 4-space indent, stylelint-config-standard
- Line endings: Unix (LF)

---

## Theme development

The UI Kit gallery is the fastest way to develop and verify theme changes:

```bash
aem up
# Open http://localhost:3000/docs/ui-kit.html
```

The gallery shows all kit primitives live against the real CSS. Use the **Theme** dropdown
to switch between `default`, `dark`, `pro`, `studio`, and `custom` themes and verify your
changes render correctly across all of them.

### Adding a new theme

1. Create `styles/themes/my-theme.css` — override `--color-*` tokens only (see AGENTS.md)
2. Register it in `scripts/asc/configurations.js`: `theme: { default: 'my-theme' }`
3. Verify in the gallery: open the UI Kit and select your theme

See `AGENTS.md → "How To: Add a Custom Theme"` for the full token reference.

---

## Ownership boundary

| Path | Who edits it |
|------|-------------|
| `scripts/asc/configurations.js` | You — the single config entry point |
| `scripts/asc/` | ASC core — do not edit; replace the whole folder on upgrades |
| `blocks/` | You — copy and modify blocks freely |
| `styles/` | You — add themes, override CSS variables |

Every file in `scripts/asc/` starts with `// ASC Core — do not edit.` as a guard. If you
need to change core behavior, use the configuration hooks in `scripts/asc/configurations.js`.
