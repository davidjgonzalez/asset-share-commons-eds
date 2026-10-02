# scripts/asc/

The Asset Share Commons framework folder.

| Path | Owner | Edit? |
|------|-------|-------|
| `configurations.js` | **You** | **Yes. This is where you start.** Every site setting lives here: AEM host, search provider, theme, renditions, collections, custom properties, asset details templates, analytics, board renderer |
| `core/` | **ASC** | **No.** Replaced wholesale when you upgrade ASC. See `core/README.md` |

## The rule: `configurations.js` is the only file at this level

Do not add a second file next to it. Where new code goes instead:

| It is... | Put it in |
|----------|-----------|
| A setting, a swappable default, or page-load wiring | `configurations.js` (or `scripts/asc.js` for lifecycle code) |
| A helper used by one block only | That block's folder, e.g. `blocks/board/board-item.js` |
| A reusable mechanism, UI part or business logic | `core/{services,parts,utils,models}/`, with `// ASC Core — do not edit.` at the top and any knobs surfaced through `configurations.js` |

## Who may import what

- `configurations.js` is imported by `core/` services (through `core/services/configurations.js`),
  by `scripts/asc.js` and by blocks. It may import a custom module you write (for example a board
  item renderer from `blocks/board/`), but it must stay free of side effects.
- `core/` must never import a block, and must not import anything from `scripts/asc/` except
  `configurations.js`.
