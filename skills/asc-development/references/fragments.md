# Fragments

How to load and use fragment pages in modals, sidebars, and other dynamic contexts.

---

## What is a Fragment?

A fragment is an **EDS fragment page** — a full HTML page at a path like `/my-fragment`, but when loaded via `loadFragment()`, only the `<main>` content is extracted and returned as a DOM element (or HTML string).

Fragment pages:
- Live at a URL path (e.g. `/details`, `/my-section`)
- Can contain any ASC blocks and standard HTML
- Are decorated by EDS like any other page
- Can accept `data-asc-asset` context from the loading block

---

## Loading Fragments

### `loadFragment(path)`

```js
import { loadFragment } from '../../scripts/asc/utils/fragments.js';

async function loadMyFragment() {
  const fragment = await loadFragment('/details');
  // fragment = <main> element with all blocks decorated
  document.body.append(fragment);
}
```

**What it returns**: A fully decorated `<main>` DOM element

**Caching**: Fragments are cached in `window.asc.cache.fragments` — repeated loads return the cached element (cloned if necessary)

---

## Eager vs. Lazy Loading

### Eager (Load Immediately)

Load the fragment as soon as the page loads:

```js
export default async function decorate(block) {
  // Eager: fetch immediately
  const fragment = await loadFragment('/details');
  block.append(fragment);
}
```

**Use when**: Fragment is always shown; don't delay page render

---

### Lazy (Load on Demand)

Load the fragment only when needed (click, hover, scroll):

```js
export default function decorate(block) {
  const button = block.querySelector('button');
  
  button.addEventListener('click', async () => {
    // Lazy: fetch only on interaction
    const fragment = await loadFragment('/details');
    showInModal(fragment);
  });
}
```

**Use when**: Fragment is optional; not always shown; defer network cost

---

## Fragment with Context (`data-asc-asset`)

Fragments can read context from parent blocks via the `data-asc-asset` attribute:

```js
// In a parent block
const fragment = await loadFragment('/details');
fragment.setAttribute('data-asc-asset', 'uuid-string');

// Now all child blocks inside the fragment can read:
// const asset = await Asset.create(block);  // reads data-asc-asset from parent
```

**Example**: The asset details modal sets `data-asc-asset` on the `<main>` element, so all `details-*` blocks inside can call `Asset.create()` and fetch the asset automatically.

---

## Fragment in a Modal

The most common pattern: load a fragment into a modal dialog.

```js
import { loadFragment } from '../../scripts/asc/utils/fragments.js';

export default function decorate(block) {
  block.querySelector('button').addEventListener('click', async () => {
    const dialog = document.createElement('dialog');
    dialog.className = 'asc-dialog';
    
    // Show loading state
    dialog.innerHTML = '<div class="asc-dialog__body">Loading...</div>';
    document.body.append(dialog);
    dialog.showModal();
    
    try {
      // Load fragment
      const fragment = await loadFragment('/details');
      
      // Set context if needed
      fragment.setAttribute('data-asc-asset', 'uuid-123');
      
      // Replace loading with loaded content
      dialog.querySelector('.asc-dialog__body').replaceWith(fragment);
    } catch (err) {
      dialog.innerHTML = '<div class="asc-dialog__body">Failed to load</div>';
    }
    
    // Close on click outside or ESC
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
  });
}
```

---

## Fragment Page Structure

A fragment page is a normal da.live page with `<main>` as the root:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Details Fragment</title>
  </head>
  <body>
    <main>
      <!-- ASC blocks here -->
      <div class="section">
        <div class="default-content-wrapper">
          <h1 data-asc-asset="...">Asset Title</h1>
        </div>
      </div>
      
      <div class="section">
        <div class="details-preview"></div>
      </div>
      
      <div class="section">
        <div class="details-actions"></div>
      </div>
    </main>
  </body>
</html>
```

The `loadFragment()` function:
1. Fetches the full HTML from the path
2. Extracts the `<main>` element
3. Decorates all blocks inside (via EDS block discovery)
4. Returns the `<main>` element

---

## Fragment with Routing (MIME-Type Based)

The asset details modal uses `assetDetails.templates` to route to different fragments based on MIME type:

```js
// In configurations.js
assetDetails: {
  templates: (asset) => {
    if (asset.mimeType?.startsWith('image/')) return '/details/image';
    if (asset.mimeType?.startsWith('video/')) return '/details/video';
    if (asset.mimeType === 'application/pdf')  return '/details/pdf';
    return '/details';  // Default
  },
},
```

Then the AssetDetails service:
1. Gets the asset
2. Calls `templates(asset)` to get the fragment path
3. Loads the fragment
4. Sets `data-asc-asset` on it
5. Shows it in a modal

---

## Fragment Caching

Fragments are cached globally to avoid repeated fetches:

```js
window.asc.cache.fragments = {
  '/details': <main>element</main>,
  '/details/image': <main>element</main>,
}
```

**Important**: When retrieving a cached fragment, EDS **clones it** so each consumer gets a fresh copy with independent block state.

You can pre-cache fragments at page load:

```js
// In delayed.js or a custom block
import { loadFragment } from '../../scripts/asc/utils/fragments.js';

// Pre-cache for instant opening
await loadFragment('/details');
await loadFragment('/details/image');
```

---

## Error Handling

```js
try {
  const fragment = await loadFragment('/my-fragment');
  block.append(fragment);
} catch (err) {
  console.error('Failed to load fragment:', err);
  block.innerHTML = '<p>Failed to load content. Please try again.</p>';
}
```

Common errors:
- Fragment path does not exist (404)
- Fragment contains blocks that fail to decorate
- Network error

---

## Fragment in a Sidebar

```js
export default function decorate(block) {
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  
  block.append(sidebar);
  
  // Load on demand
  block.querySelector('button').addEventListener('click', async () => {
    const fragment = await loadFragment('/sidebar-content');
    sidebar.replaceChildren(fragment);
  });
}
```

---

## Fragment + Forms

When a fragment contains a form, listen for submit inside the loaded fragment:

```js
async function loadFormFragment() {
  const fragment = await loadFragment('/contact-form');
  document.body.append(fragment);
  
  const form = fragment.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    await fetch('/api/submit', { method: 'POST', body: formData });
    form.innerHTML = '<p>Thank you!</p>';
  });
}
```

---

## Fragment Limitations

**Cannot do**:
- `loadFragment()` does not fetch CSS/JS external to the block — all dependencies must be imported by the blocks themselves
- Fragment must be a full page (has `<main>`); cannot load arbitrary HTML snippets
- Fragment loading is client-side only — no server-side route resolution

**Workaround**: If you need data-driven routing, calculate the path in `configurations.assetDetails.templates` and call `loadFragment(path)` with the result.

---

## Examples

### Example 1: Lazy-Load Details on Modal Open

```js
export default function decorate(block) {
  block.querySelector('[data-open-details]').addEventListener('click', async () => {
    const dialog = document.createElement('dialog');
    dialog.className = 'asc-dialog';
    document.body.append(dialog);
    dialog.showModal();
    
    try {
      const details = await loadFragment('/details');
      details.setAttribute('data-asc-asset', 'asset-uuid');
      dialog.innerHTML = '';
      dialog.append(details);
    } catch (err) {
      dialog.innerHTML = '<p>Error loading details</p>';
    }
  });
}
```

### Example 2: Pre-Cache Multiple Fragments

```js
// In delayed.js
import { loadFragment } from './scripts/asc/utils/fragments.js';

// Pre-warm cache for instant modal opens
Promise.all([
  loadFragment('/details'),
  loadFragment('/details/image'),
  loadFragment('/details/video'),
]);
```

### Example 3: Fragment with Context

```js
export default async function decorate(block) {
  const assetId = block.querySelector('button').dataset.assetId;
  
  const fragment = await loadFragment('/preview');
  fragment.setAttribute('data-asc-asset', assetId);
  
  block.append(fragment);
}
```

---

See also: [modals-and-dialogs.md](modals-and-dialogs.md) for loading fragments into modal dialogs.
