---
name: search-filter-template
description: Step-by-step guide for creating a new ASC search filter block. Walks through authoring model, QueryBuilder predicate, form field naming, JS implementation, and CSS.
---

# Block Template: Search Filter

Use this template when creating a new block that lets users filter search results by a metadata property, date range, path, tag, or any other QueryBuilder predicate.

## When to Use This Template

- Filtering by a JCR metadata property not covered by `search-property`
- Filtering by a numeric range (e.g. file size, rating)
- A custom multi-select or autocomplete UI for an existing predicate
- A hidden filter (pre-seeded QB parameters the user never sees)

**Do NOT use this template** for:
- Custom search result rendering → use the [result-item template](result-item.md)
- Keyword text search → modify `search-bar` block
- Pure display changes to an existing filter → modify the block's CSS only

---

## Authoring Model (da.live table)

Design a single-row table per configuration field. All fields are optional unless marked required.

| Cell 1 (key) | Cell 2 (value) | Notes |
|---|---|---|
| `title` | `Filter Label` | Optional. Label shown above inputs |
| `property` | `jcr:content/metadata/dc:myProp` | **Required.** JCR property to filter |
| `name` | `myprop` | Optional. QB predicate name. Defaults to property-based slug |
| `type` | `checkbox` | Optional. `checkbox` \| `radio` \| `dropdown`. Default: `checkbox` |
| `options` | One option per line: `Label: value` | Required for checkbox/radio/dropdown |
| `and` | `true` | Optional. `true` = AND multi-select; `false` = OR (default) |

**Example da.live table**:

```
| property | jcr:content/metadata/myco:brand |
| title    | Brand                           |
| options  | Adobe: adobe                    |
|          | ACME Corp: acme                 |
|          | Skyline: skyline                |
```

---

## Step 1: Create Block Files

```bash
mkdir -p blocks/search-{filter-name}
touch blocks/search-{filter-name}/search-{filter-name}.js
touch blocks/search-{filter-name}/search-{filter-name}.css
```

---

## Step 2: Implement JS (`search-{filter-name}.js`)

Copy and adapt this starting point. Replace all `{filter-name}`, `{predicate-name}`, `{default-property}` placeholders.

```js
/** @owner user */
/**
 * search-{filter-name} — {describe what this filter does}.
 *
 * Provider compatibility:
 *   QueryBuilder → {predicate-name} predicate
 *   OpenAPI      → {describe mapping or "Not supported — QueryBuilder only"}
 *
 * AEM QueryBuilder documentation:
 * https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/full-stack/search/query-builder-predicates
 *
 * Authoring (da.live table):
 *   | property | {default-property} |   (required)
 *   | title    | Filter Label        |   (optional)
 *   | options  | Label: value        |   (one per line; for checkbox/radio/dropdown)
 *   | type     | checkbox            |   (optional; checkbox | radio | dropdown)
 */
import { readBlockConfig, getOptions, addSearchEventListeners } from '../../scripts/asc/core/utils/search.js';

export default function decorate(block) {
  const config = readBlockConfig(block, {
    // Transform multi-line option content into [{label, value}] array
    options: (content) => getOptions({ content: Array.isArray(content) ? content.join('\n') : String(content) }),
  }, {
    // Default values when not authored
    name: '{predicate-name}',
    property: '{default-property}',
    type: 'checkbox',
    options: [],
  });

  block.innerHTML = html(config);
  addSearchEventListeners(block, config);    // ← required: wires inputs to asc:search:execute
}

function html(config) {
  // Hidden inputs tell the QB provider which property to filter.
  // The name pattern MUST follow: {group}_group.{name}.{parameter}
  // config.parameter(key) builds this correctly.
  return `
    <input type="hidden"
           name="${config.parameter('property')}"
           value="${config.property}"
           form="${config.form}"
           for="${config.fieldset}"/>

    ${config.title ? `<label class="search-{filter-name}__title">${config.title}</label>` : ''}

    ${config.options.map((option, i) => htmlOption(option, i, config)).join('')}
  `;
}

function htmlOption(option, index, config) {
  const name = config.parameter(index + '_value');   // e.g. 1_group.myprop.0_value
  const id = `${config.fieldset}-${index}`;
  const checked = config.initial[name] === option.value;

  return `
    <div class="search-{filter-name}__option">
      <input type="${config.type || 'checkbox'}"
             id="${id}"
             name="${name}"
             value="${option.value}"
             ${checked ? 'checked' : ''}
             data-asc-fieldset="${config.fieldset}"
             form="${config.form}"/>
      <label for="${id}">${option.label}</label>
    </div>`;
}
```

### Key concepts

| Concept | Explanation |
|---------|-------------|
| `config.form` | Always `"asc-search-form"` — all search inputs belong to this form |
| `config.group` | This block's 1-based DOM index — distinguishes same-predicate filters |
| `config.parameter(key)` | Builds `{group}_group.{name}.{key}` — the QB field name pattern |
| `config.fieldset` | Unique ID for this block's group; used to group inputs for dependency logic |
| `config.initial` | Values from the current URL — pre-checks correct options. **Date caveat:** URL persistence stores full ISO datetimes (`2024-01-15T00:00:00.000Z`); `<input type="date">` only accepts `YYYY-MM-DD`. Always strip the time suffix: `(config.initial[name] \|\| '').slice(0, 10)` |
| `addSearchEventListeners` | Wires `change` events on all interactive inputs to dispatch `asc:search:execute` |

---

## Step 3: Add CSS (`search-{filter-name}.css`)

Use `main .search-{filter-name}` as the root selector. Scope all styles under it.

```css
main .search-{filter-name} {
  margin-bottom: var(--spacing-lg);
}

main .search-{filter-name} .search-{filter-name}__title {
  display: block;
  color: var(--color-muted-fg);
  font-size: var(--body-font-size-s);
  font-weight: 600;
  margin-bottom: var(--spacing-s);
}

main .search-{filter-name} .search-{filter-name}__option {
  display: grid;
  grid-template-columns: 1rem 1fr;
  align-items: center;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-xs);
}

main .search-{filter-name} .search-{filter-name}__option input {
  accent-color: var(--color-primary);
  cursor: pointer;
}

main .search-{filter-name} .search-{filter-name}__option label {
  cursor: pointer;
  font-size: var(--body-font-size-s);
  color: var(--color-fg);
}
```

---

## Step 4: Register in the DA.live block library

This project authors in DA.live / Experience Workspace only — there's no Universal Editor
integration to register with. Instead, add an example document at
`/blocks/search-{filter-name}` in DA content (not this repo) showing the block's real authored
table — e.g. `property` / `title` / `options` rows matching what `readBlockConfig()` expects —
then add a `{ name, path }` row for it to the `library/blocks` sheet. Preview and publish both
before they show up in the Sidekick's Library panel. See `AGENTS.md` → "DA.live Block Library" and
`https://docs.da.live/administrators/guides/setup-library`.

---

## Step 5: Verify

```bash
npm run lint
```

Check in browser:
- [ ] Filter renders with correct labels and option values
- [ ] Selecting an option triggers a search (network request visible in DevTools)
- [ ] URL reflects selected values (`?1_group.{name}.0_value=...`)
- [ ] Refreshing the page pre-selects the correct options (URL state restored)
- [ ] Clearing all options triggers a new search that returns unfiltered results

---

## Checklist: Common Mistakes

| Mistake | Fix |
|---------|-----|
| Hidden inputs missing `form="${config.form}"` | Add `form="${config.form}"` — without it the input isn't part of the search form |
| Using wrong field name pattern | Always use `config.parameter(key)` — never hardcode `_group.` strings |
| Forgetting `addSearchEventListeners` | Without it, changing a checkbox won't trigger a search |
| Binding inputs inside `decorate()` manually | Use `addSearchEventListeners(block, config)` instead — it handles all input types correctly |
| Setting `<input type="date">` value directly from `config.initial` | URL persistence stores ISO datetimes (`T00:00:00.000Z` suffix); browsers silently blank date inputs that aren't `YYYY-MM-DD` — filter appears empty after refresh | Use `(config.initial[name] \|\| '').slice(0, 10)` — `adjustFormData` in the search service re-appends the time suffix before the QB query runs |
| Naming CSS selector `main .search-{name} {}` then using `.search-{name}__child` at root | All descendants must be nested: `main .search-{name} .search-{name}__child` |

---

## Reference Implementations

Read these blocks for working examples of this template:

| Block | Shows |
|-------|-------|
| [`blocks/search-property`](../../blocks/search-property/search-property.js) | Multi-value property filter; checkbox, radio, dropdown; URL state restore |
| [`blocks/search-date-range`](../../blocks/search-date-range/search-date-range.js) | Date range filter; hidden QB operation params; two-input UI |
| [`blocks/search-tags`](../../blocks/search-tags/search-tags.js) | Tag ID filter; OpenAPI compatible; same form field pattern |
| [`blocks/search-path`](../../blocks/search-path/search-path.js) | DAM path filter; QB `path` predicate |
| [`blocks/search-hidden`](../../blocks/search-hidden/search-hidden.js) | Hidden fixed parameters; no UI |

---

## QueryBuilder Predicates Quick Reference

| Use case | Predicate | Key parameters | Example |
|----------|-----------|---------------|---------|
| Metadata property | `property` | `.property`, `.value`, `.operation` | `dc:format = image/jpeg` |
| Date range | `daterange` | `.property`, `.lowerBound`, `.upperBound` | Modified last 7 days |
| Tags | `tagid` | `.N_value` | `properties:orientation/landscape` |
| DAM path | `path` | `.N_value` | `/content/dam/marketing` |
| Full text | `fulltext` | (top-level, not a group) | keyword match |
| Rating | `property` + operation | `.property=rating`, `.value`, `.operation=>=` | rating >= 4 |

Full reference: https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/full-stack/search/query-builder-predicates

---

## Example: Path Filter (DAM Folders)

Real working implementation. Demonstrates: QB path predicate, hidden parameters, multiple form field indices.

### Authoring (da.live block config)

```
| title   | Folder              |
| name    | path                |
| type    | checkbox            |
| options | All Assets: /content/dam           |
|         | Brand: /content/dam/brand         |
|         | Campaigns: /content/dam/brand/campaigns |
|         | Creative: /content/dam/creative   |
|         | Photography: /content/dam/photography |
```

### Generated Form Fields (after user selects "Brand" and "Creative")

```
1_group.path.exact = false              (hidden — don't match exact path only)
1_group.path.flat = false               (hidden — include descendants)
1_group.path.self = true                (hidden — include base path)
1_group.path.0_value = /content/dam/brand        (user selected)
1_group.path.1_value = /content/dam/creative     (user selected)
```

### QueryBuilder Request (what the search service sends to AEM)

```
/bin/querybuilder.json?
  path.0_value=/content/dam/brand&
  path.1_value=/content/dam/creative&
  path.exact=false&
  path.flat=false&
  path.self=true
```

Result: Assets under `/content/dam/brand` OR `/content/dam/creative` (QB ORs multiple path values by default).

### JS Implementation

```js
// blocks/search-path/search-path.js
import { readBlockConfig, getOptions, addSearchEventListeners } from '../../scripts/asc/core/utils/search.js';
import { htmlCheckboxes, htmlRadio, htmlDropdown } from '../search-property/search-property.js';

export default function decorate(block) {
  const config = readBlockConfig(block, {
    options: (content) => getOptions({ content: Array.isArray(content) ? content.join('\n') : String(content) }),
  }, {
    name: 'path',
    exact: false,
    flat: false,
    self: true,
    options: [],
  });

  block.innerHTML = html(config);
  addSearchEventListeners(block, config);
}

function html(config) {
  const type = config.type || 'checkbox';
  return `
    ${config.exact ? `
    <input type="hidden"
           name="${config.parameter('exact')}"
           value="${config.exact}"
           form="${config.form}"/>` : ''}

    ${config.flat ? `
    <input type="hidden"
           name="${config.parameter('flat')}"
           value="${config.flat}"
           form="${config.form}"/>` : ''}

    ${config.self ? `
    <input type="hidden"
           name="${config.parameter('self')}"
           value="${config.self}"
           form="${config.form}"/>` : ''}

    ${config.title ? `<label class="search-path__title">${config.title}</label>` : ''}

    ${type === 'radio' ? htmlRadio(config) : ''}
    ${type === 'dropdown' || type === 'select' ? htmlDropdown(config) : ''}
    ${type === 'checkbox' ? htmlCheckboxes(config) : ''}
  `;
}
```

**Key points**:
- Reuses `htmlCheckboxes`, `htmlRadio`, `htmlDropdown` from `search-property.js` (DRY)
- Hidden inputs for QB path predicates: `exact`, `flat`, `self`
- Each option becomes a separate `{group}_group.path.{index}_value` form field
- Multiple selections supported (checkboxes mode) — QB generates multiple path.N_value params

### CSS

Inherits from `search-property` helper styles; minimal custom CSS needed:

```css
main .search-path {
  margin-bottom: var(--spacing-md);
}

main .search-path .search-path__title {
  display: block;
  color: var(--label-color);
  font-weight: var(--label-font-weight);
  font-size: var(--body-font-size-s);
  margin-bottom: var(--spacing-xs);
}

/* Reuses .search-property__options, .search-property__option, .search-property__option label */
```

### Provider Support

| Provider | Support | Notes |
|----------|---------|-------|
| QueryBuilder | ✅ Full | Exact, flat, self flags respected; multiple paths ORed together |
| OpenAPI | ⚠️ Limited | Only first selected path used; exact/flat/self ignored; mapped to `filter[assetAncestorPath]` |

**Recommendation**: Use path filter primarily with QueryBuilder provider. Document OpenAPI limitation if using with asset-delivery renditions.

### Live Demo

See [search-demo.html](../../search-demo.html) for a working example with path filter + other search blocks integrated.

