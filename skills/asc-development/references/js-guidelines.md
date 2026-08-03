# JavaScript Guidelines for ASC

ASC JavaScript conventions, service usage patterns, and anti-patterns.

---

## Quick Reference

### Block Structure

```js
/** @owner user */
/**
 * my-block — description of what this block does.
 * 
 * Authoring model (in da.live):
 *   | property | value | description |
 *   | myProp   | value | What it does |
 *
 * @author Your Name
 * @requires services, readBlockConfig, addSearchEventListeners
 */

import { readBlockConfig } from '../../scripts/aem.js';
import { addSearchEventListeners } from '../../scripts/asc/core/utils/search.js';

export default function decorate(block) {
  // 1. Extract configuration
  const config = readBlockConfig(block);
  
  // 2. Build HTML
  block.innerHTML = html(config);
  
  // 3. Add event listeners (if needed)
  addEventListeners(block, config);
}

function html(config) {
  return `<div>...</div>`;
}

function addEventListeners(block, config) {
  // Use delegateEvent or data-asc-action, not element.addEventListener
}
```

### Variable Naming

Use descriptive camelCase names:

```js
✅ const assetId = 'uuid-123';
✅ const collectionName = 'My Collection';
✅ const searchResults = [];
✅ async function fetchAsset(uuid) { }

❌ const a = 'uuid-123';
❌ const x = { };
❌ const myVarForTheThing = null;
```

### Async/Await

Always use `async/await`, never `.then()` chains:

```js
// ✅ RIGHT
async function loadAsset() {
  try {
    const asset = await services.search.getAssetById(id);
    const collections = await services.collections.getAll();
    return { asset, collections };
  } catch (err) {
    console.error('Failed:', err);
  }
}

// ❌ WRONG (hard to read)
function loadAsset() {
  return services.search.getAssetById(id)
    .then(asset => services.collections.getAll()
      .then(collections => ({ asset, collections }))
    );
}
```

### Null Safety

Always check for null/undefined before using values:

```js
// ✅ RIGHT
const title = asset?.getProperty('title') ?? 'Untitled';
const count = collection?.assetIds?.length ?? 0;

// ❌ WRONG (crashes if asset is null)
const title = asset.getProperty('title');
const count = collection.assetIds.length;
```

---

## Pattern 1: Configuration Extraction

For blocks that read from a da.live authoring table:

```js
import { readBlockConfig } from '../../scripts/aem.js';

export default function decorate(block) {
  // Extracts key-value pairs from authored table
  const { title, description, icon, color } = readBlockConfig(block);
  
  block.innerHTML = `
    <div class="my-block">
      ${icon ? `<i class="${icon}"></i>` : ''}
      <h2>${title ?? 'Default Title'}</h2>
      <p>${description ?? ''}</p>
    </div>
  `;
}
```

For search filters (QB-aware):

```js
import { readBlockConfig, addSearchEventListeners } from '../../scripts/asc/core/utils/search.js';

export default function decorate(block) {
  const config = readBlockConfig(block, {
    // Transform function for options
    options: (content) => processOptions(content),
  }, {
    // Defaults
    name: 'myfilter',
    type: 'checkbox',
  });
  
  // Search-specific context auto-populated in config:
  // config.form = 'asc-search-form'
  // config.group = block's index
  // config.field = full QB field name
  // config.parameter(key) = build QB param names
  
  block.innerHTML = html(config);
  addSearchEventListeners(block, config);  // Auto-wire change events
}
```

---

## Pattern 2: Service Usage

### Get Search Results

```js
export default function decorate(block) {
  // Listen for search completion
  document.addEventListener('asc:search:complete', (e) => {
    const { results } = e.detail;  // results = { assets, total, size, offset, more }
    const { assets } = results;
    
    if (assets.length === 0) {
      block.innerHTML = '<p>No results</p>';
      return;
    }
    
    // Render assets
    block.innerHTML = assets.map(renderAsset).join('');
  });
}

function renderAsset(asset) {
  return `<div>${asset.getProperty('title')}</div>`;
}
```

### Add to Collection

```js
const button = block.querySelector('[data-add]');

button.addEventListener('click', async () => {
  try {
    const assetId = button.dataset.assetId;
    
    // Adds to active collection
    await services.collections.addAsset(assetId);
    
    // Show success state
    button.textContent = '✓ Added';
    button.disabled = true;
  } catch (err) {
    console.error('Failed to add asset:', err);
    button.textContent = 'Try again';
  }
});
```

### Fetch Single Asset

```js
export default async function decorate(block) {
  const assetId = block.dataset.assetId;
  
  if (!assetId) {
    block.innerHTML = '<p>No asset ID</p>';
    return;
  }
  
  try {
    const asset = await services.search.getAssetById(assetId);
    
    if (!asset) {
      block.innerHTML = '<p>Asset not found</p>';
      return;
    }
    
    // Render asset
    block.innerHTML = `
      <h2>${asset.getProperty('title')}</h2>
      <p>${asset.getProperty('description') ?? 'No description'}</p>
    `;
  } catch (err) {
    block.innerHTML = '<p>Error loading asset</p>';
    console.error(err);
  }
}
```

---

## Pattern 3: Event Handling

### Use Declarative Attributes

Prefer `data-asc-action` in HTML:

```html
<!-- HTML -->
<button data-asc-action="collection:add@click" data-asc-asset="uuid-123">
  Add to Collection
</button>

<!-- No JavaScript needed! The Actions service handles it. -->
```

### Listen to Events

```js
export default function decorate(block) {
  // Listen for search completion
  document.addEventListener('asc:search:complete', (e) => {
    const { results } = e.detail;
    updateUI(results);
  });
  
  // Listen for collection changes
  document.body.addEventListener('asc:collection:change', (e) => {
    const { action, id } = e.detail;
    if (action === 'activated') {
      refreshCollectionDisplay();
    }
  });
}
```

### Delegate Events

Use delegateEvent for blocks, not direct element listeners:

```js
import { delegateEvent } from '../../scripts/asc/core/utils/events.js';

export default function decorate(block) {
  // Delegate: works for all current and future .delete-btn elements
  delegateEvent(block, '.delete-btn', 'click', (e) => {
    const assetId = e.target.dataset.assetId;
    deleteAsset(assetId);
  });
}
```

---

## Pattern 4: Async Operations

### Show Loading State

```js
const button = block.querySelector('button');

button.addEventListener('click', async () => {
  button.disabled = true;
  button.textContent = 'Loading...';
  
  try {
    const result = await services.search.search(formData);
    button.textContent = 'Done';
  } catch (err) {
    button.textContent = 'Try again';
    console.error(err);
  } finally {
    button.disabled = false;
  }
});
```

### Wait for Multiple Operations

```js
export default async function decorate(block) {
  try {
    // Parallel: faster
    const [assets, collections] = await Promise.all([
      services.search.search(formData),
      services.collections.getAll(),
    ]);
    
    render(assets, collections);
  } catch (err) {
    console.error(err);
  }
}
```

---

## Pattern 5: DOM Manipulation

### Re-use Existing Elements

```js
export default function decorate(block) {
  // ✅ RIGHT: Query and re-use
  const heading = block.querySelector('h2');
  const items = block.querySelectorAll('li');
  
  heading.textContent = 'Updated Title';
  items.forEach(item => item.classList.add('updated'));
  
  // ❌ WRONG: Replace everything
  block.innerHTML = '<h2>Updated Title</h2>';  // Lost existing DOM
}
```

### Create Elements Carefully

```js
// For single elements: string concatenation or createElement
const link = document.createElement('a');
link.href = url;
link.textContent = label;
link.classList.add('my-link');

// For many elements: innerHTML (more efficient)
block.innerHTML = items.map(item => `
  <div class="item">
    <h3>${item.title}</h3>
    <p>${item.description}</p>
  </div>
`).join('');
```

### Add and Remove Classes

```js
// ✅ Use classList
element.classList.add('active');
element.classList.remove('inactive');
element.classList.toggle('expanded');

// ❌ Don't manipulate className directly
element.className = 'active inactive';  // Risky; overwrites existing classes
```

---

## Common Patterns Reference

| Task | Pattern |
|------|---------|
| Read block config | `readBlockConfig(block)` from `scripts/aem.js` |
| Wire search filter | Use `readBlockConfig` + `addSearchEventListeners` |
| Listen for search | `document.addEventListener('asc:search:complete', ...)` |
| Listen for collection | `document.body.addEventListener('asc:collection:change', ...)` |
| Add to collection | `services.collections.addAsset(assetId)` |
| Get asset | `services.search.getAssetById(uuid)` |
| Get asset property | `asset.getProperty('title')` |
| Get download URLs | `services.renditions.getRenditions(asset)` |
| Open asset details | Dispatch or use `data-asc-action="asset:details:open"` |
| Load fragment | `loadFragment('/path')` from `scripts/asc/core/utils/fragments.js` |
| Create modal | `document.createElement('dialog')` + `showModal()` |
| Delegate events | Use `data-asc-action` or `delegateEvent()` from events.js |

---

## Anti-Patterns

| Don't | Do | Why |
|------|---|-----|
| **Direct element listeners in decorate()** | Use `data-asc-action` or `delegateEvent()` | Avoids duplicate listeners; more maintainable |
| **Import another block** | Use events or configuration | Blocks should be independent |
| **Hardcode API paths** | Use `services.aem.apiUrl()` or configurations | Respects AEM host configuration |
| **Call a service before import** | Import at top of file | Services initialize on import |
| **Throw away existing DOM** | Query and re-use elements | Respects authored content |
| **`.then()` chains** | Use `async/await` | More readable |
| **No null checking** | Always use `?.` or `??` | Prevents crashes on missing data |
| **Global variables** | Use closures in functions | Avoids naming conflicts |
| **Inline styles** | Use CSS classes and tokens | CSS is themeable; maintainable |
| **`var`** | Use `const` or `let` | `const` is safe; prevents reassignment bugs |
| **No error handling** | Use `try/catch` | Helps with debugging; handles edge cases |

---

## Code Style

### Indentation & Formatting

- 2-space indentation (standard for ASC)
- Semicolons at end of statements
- Template literals for multi-line strings

```js
const html = `
  <div class="my-block">
    <h2>${title}</h2>
    <p>${description}</p>
  </div>
`;
```

### Naming Conventions

- `const MY_CONSTANT = 'value'` for module-level constants
- `functionName()` for functions and methods
- `ClassName` for classes (rare in ASC)
- `variable` or `varName` for variables (camelCase)

### Comments

Document complex logic, not obvious code:

```js
// ✅ GOOD: Explains why
// QB form fields use group numbers to organize predicates
const fieldName = `${config.group}_group.${config.name}`;

// ❌ BAD: States the obvious
const fieldName = `${config.group}_group.${config.name}`;  // Set field name
```

### Function Documentation

Use JSDoc for public functions:

```js
/**
 * Fetch and render assets in a grid.
 * 
 * @param {Array} assetIds - Array of asset UUIDs
 * @param {Object} options - Rendering options
 * @param {number} [options.columns=3] - Number of grid columns
 * @param {boolean} [options.showTitle=true] - Show asset titles
 * @returns {Promise<Element>} The rendered grid element
 * @throws {Error} If assets cannot be fetched
 */
async function renderAssetGrid(assetIds, options = {}) {
  // implementation
}
```

---

## Debugging Tips

### Log Events

```js
// See all asc:* events
document.addEventListener('asc:search:complete', (e) => console.log('search:complete', e));
document.body.addEventListener('asc:collection:add', (e) => console.log('collection:add', e));
```

### Check Service State

```js
// In browser console
await services.collections.getActive()
services.renditions.getRenditions(asset)
```

### Inspect Block Config

```js
// In decorate()
const config = readBlockConfig(block);
console.log('Block config:', config);
```

### Monitor Async Operations

```js
// Show when async operations start/finish
const origSearch = services.search.search;
services.search.search = async function(formData) {
  console.time('search');
  const result = await origSearch.call(this, formData);
  console.timeEnd('search');
  return result;
};
```

---

## Performance Considerations

### Lazy Load Non-Critical Resources

```js
// Load fragment only when needed
button.addEventListener('click', async () => {
  const fragment = await loadFragment('/details');  // Lazy
  dialog.append(fragment);
});

// vs. eager at page load
const fragment = await loadFragment('/details');  // Early
```

### Use Parallel Requests

```js
// ✅ Parallel (faster)
const [a, b, c] = await Promise.all([
  services.search.getAssetById('id1'),
  services.search.getAssetById('id2'),
  services.search.getAssetById('id3'),
]);

// ❌ Sequential (slower)
const a = await services.search.getAssetById('id1');
const b = await services.search.getAssetById('id2');
const c = await services.search.getAssetById('id3');
```

### Debounce Input Events

```js
function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

const debouncedSearch = debounce(() => {
  document.dispatchEvent(new CustomEvent('asc:search:execute'));
}, 300);

input.addEventListener('input', debouncedSearch);
```

---

## Code Quality

### ESLint

ASC uses `airbnb-base` ESLint config:

```bash
npm run lint:js          # Check errors
npm run lint:fix         # Auto-fix
```

Common issues:
- Unused variables
- Missing semicolons
- `var` instead of `const`/`let`
- `console.log` in production code

### Testing in Development

```bash
aem up --no-open
# Open http://localhost:3000/my-test-page
# Interact and check console for errors
```

---

See also: [services-api.md](services-api.md), [recipes.md](recipes.md), [block-conventions.md](block-conventions.md)
