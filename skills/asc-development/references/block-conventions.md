# Block Conventions

How to structure and implement ASC blocks following the canonical pattern.

---

## Block Folder Structure

```
blocks/my-block/
  my-block.js       ← Main decoration function
  my-block.css      ← Scoped styles
```

**Never create**:
- `my-block.html` — blocks are not HTML; they decorate delivered content
- Subdirectories or multiple JS files — keep it flat

---

## Block JavaScript Pattern

### Minimal Export

Every block JS file exports a default `decorate()` function:

```js
/** @owner user */
/**
 * my-block — what this block does.
 *
 * Authoring (da.live table):
 *   | property1 | value1 | description |
 *   | property2 | value2 | description |
 *
 * Optional provider notes, AEM docs links, etc.
 */

export default function decorate(block) {
  // 1. Extract configuration from block content
  const config = readBlockConfig(block);

  // 2. Build HTML (re-use existing DOM where possible)
  block.innerHTML = html(config);

  // 3. Wire up event listeners (for interactive blocks)
  addEventListeners(block, config);
}

function html(config) {
  // Return HTML string
  return `<div>...</div>`;
}

function addEventListeners(block, config) {
  // Prefer data-asc-action over manual binding
  // OR use utility: addSearchEventListeners(block, config)
}
```

### Pattern: Re-use Existing DOM

The EDS platform delivers block content as authored. Always re-use it when possible:

```js
export default function decorate(block) {
  // ❌ WRONG: throw away existing elements
  block.innerHTML = `<h2>Title</h2><p>Text</p>`;

  // ✅ RIGHT: re-use delivered elements
  const heading = block.querySelector('h2');
  const paragraph = block.querySelector('p');
  
  const figure = document.createElement('figure');
  figure.append(heading, paragraph);  // Re-use
  
  block.replaceChildren(figure);
}
```

**Why**: Authors customize in da.live. Respecting their content is respectful of their work.

---

## Configuration Extraction: `readBlockConfig()`

### For Details Blocks (Simple Configuration)

Use `readBlockConfig(block)` to convert a da.live table into a configuration object:

```js
import { readBlockConfig } from '../../scripts/aem.js';

export default function decorate(block) {
  const config = readBlockConfig(block);
  // config = { property: 'value', title: 'My Title', ... }
}
```

### For Search Filter Blocks (QB Predicates)

Use the search-specific `readBlockConfig(block, transform, defaults)` from `scripts/asc/utils/search.js`:

```js
import { readBlockConfig, getOptions, addSearchEventListeners } from '../../scripts/asc/utils/search.js';

export default function decorate(block) {
  const config = readBlockConfig(block, {
    // Transform function: post-process raw content
    options: (content) => getOptions({ content: Array.isArray(content) ? content.join('\n') : String(content) }),
  }, {
    // Default values when authoring is absent
    name: 'mypredicate',
    property: 'jcr:content/metadata/dc:format',
    type: 'checkbox',
    options: [],
  });

  // Search-specific context auto-populated:
  // config.form = 'asc-search-form'
  // config.group = block's 1-based index
  // config.field = full QB field name
  // config.parameter(key) = function to build QB params
  // config.fieldset = unique ID for this filter group
  // config.initial = values from URL (?key=value)

  block.innerHTML = html(config);
  addSearchEventListeners(block, config);  // ← Wires input changes to asc:search:execute
}
```

---

## Content Model — da.live Table

Blocks are authored as tables in da.live. Each row becomes a config key-value pair.

### Simple Table (Most Blocks)

```
| property   | value           |
| title      | Search Results  |
| icon       | search          |
| theme      | dark            |
```

Becomes:
```js
{ property: 'value', title: 'Search Results', icon: 'search', theme: 'dark' }
```

### Multi-Row Values (Lists, Options)

For cells with multiple lines in da.live (content below the first line), the `readBlockConfig` helper collects them into an array:

```
| options  | Label: value1 |
|          | Label: value2 |
|          | Label: value3 |
```

Becomes:
```js
{ options: ['Label: value1', 'Label: value2', 'Label: value3'] }
```

Transform it in a read function:
```js
import { getOptions } from '../../scripts/asc/utils/search.js';

const config = readBlockConfig(block, {
  options: (content) => getOptions({ content: Array.isArray(content) ? content.join('\n') : String(content) }),
});
// config.options = [{ label: 'Label', value: 'value1' }, ...]
```

---

## CSS: Root Selector and Nesting

### Root Selector: `main .block-name`

```css
main .my-block {
  /* Block root styles */
  display: grid;
  gap: var(--spacing-md);
}
```

**Not** `.block.my-block` (ASC v1 pattern) — the future state uses `main` prefix.

### Child Elements (Nested)

```css
main .my-block {
  & h2 { /* child heading */ }
  
  & .my-block__options { /* BEM-style grandchild */ }
  
  & button { /* descendant button */ }
}
```

### Variants (CSS Modifiers)

```css
main .my-block {
  & &.compact { /* variant: less spacing */ }
  
  & &.dark { /* theme variant */ }
}
```

### Important Rules

1. **All selectors scoped to block root** — never write `h2 { }` or `.title { }` bare
2. **Use CSS nesting** — no separate rule blocks
3. **Use semantic color tokens** — `--color-primary`, `--color-fg`, etc.
4. **Use structural tokens** — `--spacing-*`, `--border-radius-*`, `--shadow-*`
5. **Mobile-first responsive** — base styles for mobile, then `@media (width >= 768px)` for larger

Example:

```css
main .my-block {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--color-card);
  border-radius: var(--border-radius-m);
  
  & h2 {
    font-size: var(--heading-font-size-m);
    color: var(--color-fg);
    margin: 0;
  }
  
  & .my-block__items {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--spacing-sm);
  }
  
  /* Tablet and up */
  @media (width >= 768px) {
    flex-direction: row;
    gap: var(--spacing-xl);
  }
  
  /* Variant */
  & &.compact {
    padding: var(--spacing-m);
    gap: var(--spacing-xs);
  }
}
```

---

## Block Variants

Variants are CSS class names added by da.live. Handle them in JS only when behavior changes, not just styling.

### CSS-Only Variant (No JS)

```
Block name in da.live: my-block compact
```

Results in:
```html
<div class="block my-block compact">
  ...
</div>
```

Handle in CSS only:
```css
main .my-block {
  & &.compact {
    padding: var(--spacing-s);
  }
}
```

### Behavior Variant (Requires JS)

```js
export default function decorate(block) {
  const isCompact = block.classList.contains('compact');
  
  if (isCompact) {
    // Different behavior for compact variant
    block.innerHTML = compactHtml(config);
  } else {
    block.innerHTML = normalHtml(config);
  }
}
```

---

## Common Blocks Reference

| Block | Pattern | Key learning |
|-------|---------|--|
| `search-property` | Search filter | QB form field naming, `addSearchEventListeners`, URL state restore |
| `search-date-range` | Search filter with ranges | Hidden QB params, date inputs |
| `search-results` | Display results | Services integration, multiple view modes (cards/masonry/list), Parts usage |
| `details-property` | Simple display | Asset from DOM, `readBlockConfig`, null safety |
| `details-modal` | Fragment loading | `loadFragment()`, modal injection, asset context propagation |
| `details-actions` | Buttons + events | Declarative `data-asc-action`, conditional rendering, Part usage (`collectionToggle`) |
| `collection` | Form + state | Collections service integration, localStorage, reactive updates |
| `stub` | Simple display | Asset count, link, minimal JS |

Read the implementations in `blocks/` to see these patterns in context.

---

## Anti-Patterns

| Don't | Do |
|------|---|
| **Manual event binding in decorate()** | Use `data-asc-action` attributes or `addSearchEventListeners(block, config)` |
| **Hardcode QB field names** | Use `config.parameter(key)` from `readBlockConfig` |
| **Throw away existing DOM** | Query and re-use delivered elements; only create new when needed |
| **Import another block** | Use events and `data-asc-action` for inter-block communication |
| **Create a service for a display value** | Register a property handler in `configurations.js` instead |
| **Write CSS outside `main .block-name` scope** | All selectors must nest under block root |
| **Use `--text-color` or `--background-color`** | Use ASC semantic tokens: `--color-fg`, `--color-bg`, `--color-primary`, etc. |
| **Check for null properties without fallback** | Always provide `config.default` or show `—` when property is missing |

---

## Debugging Blocks

### Block not rendering?

1. Check browser console for errors
2. Verify `readBlockConfig` is called before `block.innerHTML` assignment
3. Check that da.live table exists and has the right row labels

### Block renders but styles wrong?

1. Check CSS selector — is it `main .block-name {}`?
2. Verify color/spacing tokens are correct — check `styles/tokens.css`
3. Use browser DevTools to inspect computed styles; check for overrides

### Events not firing?

1. Check that inputs have `form="${config.form}"` and `for="${config.fieldset}"`
2. Verify `addSearchEventListeners` is called (for search blocks)
3. Check that `data-asc-action` is spelled correctly
4. Look in browser DevTools → Network for the search request

### Config not reading from da.live?

1. Verify table structure: first cell is property name, second cell is value
2. Check for extra whitespace or typos in property names
3. Multi-row values: ensure continuation rows start with empty first cell
4. Log `config` to console to see what was parsed

---

## Testing Blocks

```bash
# Start dev server
aem up --no-open --forward-browser-logs

# Open test page
http://localhost:3000/your-test-page

# Check console for errors
DevTools → Console tab
```

For search blocks:
- [ ] Selecting an option triggers a network request
- [ ] Results update after search completes
- [ ] URL reflects selection (`?1_group.property.0_value=abc`)
- [ ] Refreshing the page restores the selection (URL state)

For details blocks:
- [ ] Open asset details (`?asset={uuid}`)
- [ ] Block reads `data-asc-asset` from parent `<main>`
- [ ] Asset properties display correctly
- [ ] Null/missing properties don't crash (show fallback)

For display blocks:
- [ ] Block renders on page load
- [ ] Responsive on mobile (< 768px) and desktop
- [ ] No console errors
- [ ] Colors and spacing match design
