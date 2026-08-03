# Accessibility Guidelines for ASC EDS Blocks

Target: WCAG 2.1 Level AA. These are the patterns most relevant to ASC.

---

## Landmark Regions

Use semantic landmark elements so AT users can jump directly to sections:

| Role | Element | Use for |
|------|---------|---------|
| `main` | `<main>` | Page main content (EDS adds this) |
| `search` | `role="search"` on wrapper | Any search input area |
| `navigation` | `<nav>` | Header/footer nav |
| `region` | `<section aria-label="…">` | Named content sections |

The `asc-ui-search` wrapper must include `role="search"`:
```html
<div class="asc-ui-search" role="search">
  <input type="search" placeholder="Search assets…" aria-label="Search assets">
</div>
```

---

## Buttons and Links

**Icon-only buttons** must have `aria-label`. Always escape with `escAttr()`:
```js
import { escAttr } from '../../scripts/asc/html.js';
// …
`<button type="button" aria-label="${escAttr(label)}">
  <svg aria-hidden="true">…</svg>
</button>`
```

**Decorative icons** (SVG, emoji, symbol) that are beside visible text must have `aria-hidden="true"`:
```html
<button type="button">
  <span aria-hidden="true">⬇</span> Download
</button>
```

**Links vs buttons**: use `<a href>` for navigation, `<button type="button">` for actions. Never use `<div>` or `<span>` as a clickable element.

---

## Form Controls

### Labels

Every form control needs an accessible name via one of:
1. Wrapping `<label>`: `<label><input type="checkbox"> Include subfolders</label>`
2. Associated `<label for>`: `<label for="q">Search</label><input id="q">`
3. `aria-label`: `<input aria-label="Search assets">`
4. `aria-labelledby`: `<input aria-labelledby="heading-id">`

Do **not** use `<label>` to display read-only metadata — use `<dt>` in a `<dl>` instead.

### Grouped Controls

Checkboxes and radios that share a topic must be wrapped in `<fieldset>` + `<legend>`:
```html
<fieldset>
  <legend>File format</legend>
  <label><input type="checkbox" value="jpg"> JPEG</label>
  <label><input type="checkbox" value="png"> PNG</label>
</fieldset>
```

### Select Elements

Standalone selects without a visible `<label>` need `aria-label`:
```html
<select aria-label="Sort order">…</select>
```

### Switch / Toggle

Use `role="switch"` + `aria-checked` on toggle inputs:
```html
<label class="asc-ui-switch">
  <input type="checkbox" role="switch" aria-checked="false">
  <span class="asc-ui-switch__track"><span class="asc-ui-switch__thumb"></span></span>
  <span>Include subfolders</span>
</label>
```

Update `aria-checked` on change:
```js
input.setAttribute('aria-checked', String(input.checked));
```

### Toggle Buttons (`aria-pressed`)

`aria-pressed` must always be `"true"` or `"false"` — never an empty string:
```html
<button type="button" aria-pressed="false">Add to collection</button>
```

---

## Lists

Use `<ul role="list">` + `<li>` for card grids and result lists so AT announces item count:
```html
<ul role="list" class="collections__grid">
  <li class="asc-ui-card">…</li>
</ul>
```

---

## Dialogs / Modals

Use the native `<dialog>` element — it provides role, focus trap, and Esc handling:
```html
<dialog aria-labelledby="modal-title">
  <h2 id="modal-title">Asset Details</h2>
  <button type="button" aria-label="Close">✕</button>
  <div class="content">…</div>
</dialog>
```

**Focus management**:
1. Capture trigger before opening: `const trigger = document.activeElement;`
2. Move focus into dialog on open: `dialog.showModal()` does this automatically for `<dialog>`
3. Restore focus on close: `trigger?.focus();`

Wire `aria-labelledby` dynamically when fragment content loads:
```js
const heading = content.querySelector('h1, h2, h3');
if (heading) {
  if (!heading.id) heading.id = 'modal-title';
  dialog.setAttribute('aria-labelledby', heading.id);
}
```

---

## Images

| Context | `alt` value |
|---------|------------|
| Asset thumbnail (meaningful to user) | `asset.description \|\| asset.title \|\| asset.name \|\| ''` |
| Decorative / duplicate (title shown in card) | `""` (empty string, not omitted) |
| Icon image | `""` + `aria-hidden="true"` on wrapper |

Never omit the `alt` attribute — omitting it causes AT to read the `src` URL.

---

## Focus Visibility

All interactive elements must show a focus indicator when using keyboard navigation. The UI Kit provides `:focus-visible` styles for:
- `.btn` / `.btn--ghost` / `.btn--icon`
- `.asc-ui-menu__item`
- `.asc-ui-segmented__option`
- `.asc-ui-icon-btn`
- `.asc-ui-action`
- `.asc-ui-card--interactive`
- `.asc-ui-asset-card--interactive`

Use these Kit classes rather than writing custom interactive elements that lack focus styles.

Custom interactive elements must add:
```css
&:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
}
```

---

## Screen Reader–Only Text

Hide text visually but keep it available to AT using the `.sr-only` pattern:
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
```

---

## WCAG 2.1 AA Quick Reference

| Criterion | What it means for ASC |
|-----------|----------------------|
| 1.1.1 Non-text Content | `alt` on every `<img>`; `aria-label` on icon buttons |
| 1.3.1 Info and Relationships | Semantic HTML: headings, lists, tables, `<fieldset>` |
| 1.4.3 Contrast | Use `--color-*` tokens (designed to meet 4.5:1) |
| 2.1.1 Keyboard | Every interactive element reachable and operable via Tab/Enter/Space |
| 2.4.3 Focus Order | Tab order matches visual reading order |
| 2.4.7 Focus Visible | `:focus-visible` on all interactive elements |
| 4.1.2 Name, Role, Value | `aria-label`, `role`, `aria-checked`, `aria-pressed`, `aria-expanded` |
| 4.1.3 Status Messages | Use `role="status"` or `aria-live` for dynamic messages (loading, errors) |
