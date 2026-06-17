# Parts — Reusable UI Components

Parts are **plain functions** that return HTML strings. They are reusable across blocks without direct coupling. Unlike blocks, Parts are not decorated by EDS — they are imported and called explicitly.

---

## Part Pattern

A Part is a simple function:

```js
// scripts/asc/parts/my-part/my-part.js
/**
 * @param {Asset}  asset
 * @param {object} [options]
 * @returns {string} HTML string
 */
export default function myPart(asset, options = {}) {
  const { title, showThumb } = options;
  return `
    <div class="asc-my-part" data-asc-asset="${asset.uuid}">
      ${showThumb ? `<img src="${asset.getProperty('thumbnail')}" alt="">` : ''}
      <h3>${title || asset.getProperty('title')}</h3>
    </div>
  `;
}
```

**Key rules**:
- No class, no constructor, no state
- Returns an HTML string
- Each Part loads its own CSS via `loadCSS()` at import time
- Never bind events directly — all events use `data-asc-action` on the returned HTML
- CSS class prefix: `.asc-{part-name}`

---

## CSS Conventions for Parts

Part CSS is scoped to `.asc-{part-name}`:

```css
/* scripts/asc/parts/my-part/my-part.css */
.asc-my-part {
  display: flex;
  gap: var(--spacing-md);
  
  & img {
    width: 64px;
    height: 64px;
    border-radius: var(--border-radius-m);
    object-fit: cover;
  }
  
  & h3 {
    margin: 0;
    font-size: var(--heading-font-size-s);
  }
}
```

**Not** `.block.my-part` — Parts use `.asc-` prefix, not `.block-` prefix.

---

## Using Parts in Blocks

### Basic Usage

```js
import myPart from '../../scripts/asc/parts/my-part/my-part.js';

export default function decorate(block) {
  const assets = [...];
  
  // Call the Part for each asset
  const html = assets.map((asset) => myPart(asset)).join('');
  
  block.innerHTML = html;
}
```

### With Options

```js
import myPart from '../../scripts/asc/parts/my-part/my-part.js';

export default function decorate(block) {
  const assets = [...];
  
  block.innerHTML = assets.map((asset) => 
    myPart(asset, {
      title: asset.getProperty('title'),
      showThumb: true,
    })
  ).join('');
}
```

---

## Built-in Parts

### `assetTeaser(asset, options?)`

Renders a card-style asset teaser with thumbnail, title, and optional properties.

**Location**: `scripts/asc/parts/asset-teaser/`

**Basic**:
```js
import assetTeaser from '../../scripts/asc/parts/asset-teaser/asset-teaser.js';

block.innerHTML = assets.map(asset => assetTeaser(asset)).join('');
```

**Options**:
```js
assetTeaser(asset, {
  title: 'Custom Title',         // Override title
  showProperties: ['file-type'],  // Show specific properties
  renderProperty: (name, asset) => {
    // Custom render function for a property
    if (name === 'file-type') return `<span>${asset.getProperty('file-type')}</span>`;
    return asset.getProperty(name);
  },
})
```

**Returns**: HTML string with `.asc-asset-teaser` root element

---

### `collectionToggle(asset, options?)`

Renders an add/remove collection toggle button. Updates reactively when collection state changes.

**Location**: `scripts/asc/parts/collection-toggle/`

**Basic**:
```js
import collectionToggle from '../../scripts/asc/parts/collection-toggle/collection-toggle.js';

// Renders both "Add" and "Remove" buttons; CSS hides the inactive one
block.innerHTML = collectionToggle(asset);
```

**Default labels**:
- Add: "Add to {name}" (where {name} is the active collection name)
- Remove: "Remove from {name}"

**Custom labels**:
```js
collectionToggle(asset, {
  addLabel: 'Save to {name}',
  removeLabel: 'Saved ✓',
})
```

**Target specific collection**:
```js
collectionToggle(asset, {
  collectionId: 'specific-collection-uuid',  // instead of active collection
})
```

**How it works**:
1. Part imports once globally and sets up a listener for `asc:collection:change`
2. Returns HTML with both states rendered
3. All instances on the page share one global listener
4. When collections change, all instances update (state is hydrated from service)
5. No per-block wiring needed

---

### `picture(asset, options?)`

Renders a responsive `<picture>` element with srcset fallbacks for different widths.

**Location**: `scripts/asc/parts/picture/`

**Basic**:
```js
import picture from '../../scripts/asc/parts/picture/picture.js';

block.innerHTML = `<figure>${picture(asset)}</figure>`;
```

**Options**:
```js
picture(asset, {
  alt: 'Custom alt text',        // Override alt
  sizes: '(max-width: 768px) 100vw, 50vw',  // Responsive sizes
  widths: [400, 800, 1200],     // Breakpoints
})
```

**Returns**: HTML `<picture>` element with `<source>` and `<img>` tags

---

## Creating a Custom Part

### Step 1: Create Files

```
scripts/asc/parts/my-new-part/
  my-new-part.js      ← Main function
  my-new-part.css     ← Scoped styles
```

### Step 2: Import CSS

```js
// scripts/asc/parts/my-new-part/my-new-part.js
import { loadCSS } from '../../../aem.js';

loadCSS(`${import.meta.url.split('/').slice(0, -1).join('/')}/my-new-part.css`);

export default function myNewPart(asset, options = {}) {
  // ...
}
```

### Step 3: Return HTML String

```js
export default function myNewPart(asset, options = {}) {
  const { label, interactive } = options;
  
  return `
    <div class="asc-my-new-part" ${interactive ? 'data-asc-action="asset:share@click"' : ''} data-asc-asset="${asset.uuid}">
      <h4>${label}</h4>
      <p>${asset.getProperty('title')}</p>
    </div>
  `;
}
```

### Step 4: Scope CSS

```css
/* scripts/asc/parts/my-new-part/my-new-part.css */
.asc-my-new-part {
  padding: var(--spacing-md);
  background: var(--color-muted);
  border-radius: var(--border-radius-m);
  
  & h4 {
    margin: 0 0 var(--spacing-xs) 0;
    font-size: var(--heading-font-size-s);
  }
  
  & p {
    margin: 0;
    color: var(--color-muted-fg);
  }
}
```

### Step 5: Use in a Block

```js
import myNewPart from '../../scripts/asc/parts/my-new-part/my-new-part.js';

export default function decorate(block) {
  const assets = [...];
  block.innerHTML = assets.map(a => myNewPart(a, { label: 'Featured' })).join('');
}
```

---

## Event Binding in Parts

**Never** bind events directly in a Part. Instead, use `data-asc-action`:

```js
// ❌ WRONG: Events won't work (Part is just HTML)
export default function myPart(asset) {
  const html = `<button id="my-btn">Share</button>`;
  
  // This runs immediately but document doesn't have #my-btn yet!
  document.getElementById('my-btn')?.addEventListener('click', () => {
    console.log('Clicked');
  });
  
  return html;
}

// ✅ RIGHT: Use data-asc-action
export default function myPart(asset) {
  return `
    <div data-asc-action="asset:share@click" data-asc-asset="${asset.uuid}">
      <button>Share</button>
    </div>
  `;
}
```

The Actions service listens globally and handles all events delegated via `data-asc-action`.

---

## Reactive Parts (collectionToggle Pattern)

Parts that need to stay in sync with application state should listen to events **once at import time**:

```js
// scripts/asc/parts/my-reactive-part/my-reactive-part.js
import services from '../../services/services.js';

// Set up listener once when Part is imported
document.body.addEventListener('asc:collection:change', (e) => {
  // Re-hydrate all instances of this Part on the page
  document.querySelectorAll('.asc-my-reactive-part').forEach(async (el) => {
    const assetId = el.dataset.ascAsset;
    const asset = await services.search.getAssetById(assetId);
    
    const inCollection = await services.collections.hasAsset(assetId);
    el.dataset.inCollection = inCollection;
    
    // Update button text or state
    const btn = el.querySelector('button');
    btn.textContent = inCollection ? 'Remove' : 'Add';
  });
});

export default function myReactivePart(asset, options = {}) {
  // Render both states; CSS shows/hides based on [data-in-collection]
  return `
    <div class="asc-my-reactive-part" data-asc-asset="${asset.uuid}">
      <button class="add" data-asc-action="collection:add@click">Add</button>
      <button class="remove" data-asc-action="collection:remove@click">Remove</button>
    </div>
  `;
}
```

This pattern ensures **all instances stay in sync** with the application state without per-instance wiring.

---

## Parameter Passing

Parts accept an `options` object. Keep it flat and document it:

```js
/**
 * Card teaser for search results.
 * 
 * @param {Asset} asset - The asset to render
 * @param {Object} [options]
 * @param {string} [options.title] - Override title
 * @param {boolean} [options.showThumbnail=true] - Show thumbnail
 * @param {string[]} [options.properties] - Additional properties to show
 * @param {Function} [options.onShare] - NOT ALLOWED (events in Parts)
 * @returns {string} HTML
 */
export default function myPart(asset, options = {}) {
  const {
    title,
    showThumbnail = true,
    properties = [],
  } = options;
  
  // ...
}
```

---

## Anti-Patterns

| Don't | Do |
|------|---|
| **Export a class or constructor** | Export a plain function |
| **Bind events directly in the Part** | Use `data-asc-action` attributes |
| **Use `document.getElementById` or `querySelector`** | The Part returns HTML; blocks insert it. Let the block handle the DOM |
| **Call a service inside the Part** | Services are for blocks; Parts stay pure (mostly) |
| **Create a CSS class like `.block.my-part`** | Use `.asc-{part-name}` prefix |
| **Store state in the Part** | Use services for state; Parts re-render on demand |
| **Return a DOM element instead of HTML string** | Parts return HTML strings; blocks convert to DOM |

---

## Testing Parts

```bash
# Create a test block that uses your Part
blocks/test-my-part/test-my-part.js

export default async function decorate(block) {
  const asset = await Asset.create(block);
  block.innerHTML = myPart(asset, { option: 'value' });
}
```

Then author a test page with your test block and inspect the output.

---

## Part vs. Block

| Aspect | Part | Block |
|--------|------|-------|
| **Exports** | Plain function | `decorate(block)` function |
| **Returns** | HTML string | Modifies `block` in place |
| **State** | No state (functions) | Can have state (closures) |
| **Events** | Declarative only (`data-asc-action`) | Can bind events |
| **Reusability** | Across multiple blocks | Single block |
| **CSS scope** | `.asc-{name}` | `main .{name}` (future) |
| **Services** | Can use (carefully) | Can use freely |

---

See also: [block-conventions.md](block-conventions.md#block-variants), [cross-block-communication.md](cross-block-communication.md#pattern-2-collection-toggle-reactive)
