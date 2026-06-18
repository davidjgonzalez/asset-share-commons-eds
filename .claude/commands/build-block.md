# /build-block — ASC Block Builder

A structured, kit-first workflow for creating or updating an ASC EDS block.

---

## When to use

Run `/build-block` whenever you are:
- Creating a new block from scratch
- Updating an existing block's markup or CSS
- Adding new behavior or state to a block

---

## Step 1 — Identify primitives (mandatory first)

Before touching any code, open `docs/UI_KIT.md` and identify which kit primitives compose
the block. Every block must be built from kit primitives — writing bespoke CSS that
reimplements a primitive is a bug.

Questions to answer:
- What is the block's primary content unit? (card, row, table, list item?)
- Does it have empty states? Loading states?
- Does it have action buttons, badges, chips, counts?
- Does it have a dialog or panel container?

Common compositions:

| Block type | Typical primitives |
|---|---|
| Asset grid / card results | `asc-ui-card` + `asc-ui-empty-state` + `asc-ui-skeleton` |
| Asset list results | `asc-ui-asset-row` + `asc-ui-empty-state` + `asc-ui-skeleton` |
| Collection management | `asc-ui-card` + `asc-ui-badge` + `asc-ui-empty-state` |
| Filter dropdown | `asc-ui-control` + `asc-ui-dropdown` + `asc-ui-dropdown__item` items |
| Asset details modal | `.asc-dialog` + `asc-ui-metadata` |
| Switcher / popover menu | `asc-ui-dropdown` + `asc-ui-count` |
| Download / sheet rows | `asc-ui-asset-row` + `.btn` |
| Loading states | `asc-ui-skeleton` (content area) + `asc-ui-spinner` (inline wait) |

---

## Step 2 — Scaffold the block

### File structure
```
blocks/<block-name>/
  <block-name>.js    ← default export: decorate(block)
  <block-name>.css   ← scoped to .block.<block-name>
```

### JavaScript shell
```js
/** @owner user */
import services from '../../scripts/asc/services/services.js';
import { delegateEvent } from '../../scripts/asc/utils/events.js';

export default async function decorate(block) {
  // 1. Read block config (authored rows become your config object)
  // 2. Build initial HTML from kit primitives
  // 3. Wire events via delegateEvent(block, ...)
}
```

Key rules:
- Import services from `scripts/asc/services/services.js` — not individually
- Never bind events with `addEventListener` directly on child elements; always use
  `delegateEvent(block, selector, event, handler)` from `scripts/asc/utils/events.js`
- Use `data-asc-action="noun:verb@event"` for standard ASC actions (collection:add,
  asset:details:open, etc.) — the Actions service handles these globally
- Use `data-asc-asset="<uuid>"` to attach an asset reference to DOM elements

### CSS shell
```css
.block.<block-name> {
    /* layout only: grid, gap, spacing between primitives */
    /* do not reimplement kit primitive styles here */
}
```

CSS rules (full guide: `docs/CSS_CONVENTION.md`):
- Root selector is always `.block.<block-name>` — never a bare class
- Use CSS nesting for children and modifiers
- Colors: `--color-*` semantic tokens only (e.g. `--color-primary`, `--color-border`)
- Spacing: `--spacing-xs/sm/md/lg/xl` from `styles/tokens.css`
- Typography: `--body-font-size-s/xs`, `--heading-font-size-s/m/l/xl`
- Mobile-first: `@media (width >= 768px)` syntax
- No hard-coded px, rem, hex, or rgb values — tokens only

---

## Step 3 — Compose with kit primitives

Copy canonical markup from `docs/UI_KIT.md` catalog entries. Rules:
1. Keep `.asc-ui-*` and `.btn` classes exactly as documented — do not rename them
2. Add a block-scoped wrapper class only for layout (grid columns, gaps between primitives)
3. Never override kit styles inside block CSS — if the primitive looks wrong, go to Step 4

Example pattern — a card grid with empty state:
```js
function buildGrid(assets) {
  if (!assets.length) {
    return `<div class="asc-ui-empty-state">
      <p>No assets found.</p>
    </div>`;
  }
  return `<ul class="my-block__grid">
    ${assets.map((asset) => `
      <li>
        <article class="asc-ui-card" data-asc-asset="${asset.uuid}"
                 data-asc-action="asset:details:open@click">
          <div class="asc-ui-card__media">
            <img src="${asset.getProperty('thumbnail')}" alt="${asset.getProperty('title')}">
          </div>
          <div class="asc-ui-card__body">
            <h3 class="asc-ui-card__title">${asset.getProperty('title')}</h3>
            <p class="asc-ui-copy">${asset.getProperty('file-type')} · ${asset.getProperty('file-size')}</p>
          </div>
        </article>
      </li>`).join('')}
  </ul>`;
}
```

---

## Step 4 — Extend the kit (if needed)

If a primitive needs to look different for this block, the change belongs in the kit —
not inside block CSS. Procedure:

1. Add a modifier class to `styles/asc/ui-kit.css`, tagged with `/* @kit <name> */`:
   ```css
   /* @kit card */
   .asc-ui-card--compact {
       /* narrower padding variant */
   }
   ```
2. Add a gallery tile to `ui-kit.html` showing the new variant with its markup
3. Document the variant in `docs/UI_KIT.md` under the primitive's catalog entry
4. Verify it renders correctly under all themes (default, dark, studio)
5. Run `npm run lint:css`

Only after the kit is extended: use the new variant class in the block.

---

## Step 5 — Verify

Run these checks before considering the block done:

```bash
npm run lint          # JS (ESLint airbnb-base) + CSS (stylelint-config-standard)
```

Manual checks:
- [ ] Checked `docs/UI_KIT.md` for existing primitives before writing new CSS?
- [ ] Block CSS contains only layout rules (grid, gap, spacing between primitives)?
- [ ] No hard-coded colors, sizes, or radius values in block or kit CSS?
- [ ] Events use `delegateEvent(block, ...)` — not direct `addEventListener` on child elements?
- [ ] Standard ASC actions use `data-asc-action` — not custom event listeners?
- [ ] New kit variants documented and verified across all themes?
- [ ] `npm run lint` passes clean?

---

## Quick reference

| Need | Where to look |
|------|--------------|
| Kit primitives catalog | `docs/UI_KIT.md` |
| Kit visual gallery | `ui-kit.html` |
| Kit CSS source | `styles/asc/ui-kit.css` (grep `@kit <name>`) |
| CSS token reference | `styles/tokens.css` + `styles/styles.css` |
| CSS conventions | `docs/CSS_CONVENTION.md` |
| Event binding | `scripts/asc/utils/events.js` → `delegateEvent()` |
| All services | `scripts/asc/services/services.js` |
| ASC event names | `AGENTS.md` → "Custom Events" |
| Data attributes | `AGENTS.md` → "Data Attributes" |
| Block examples | `blocks/` — existing blocks are reference implementations |
