# Recipes — Copy-Paste Code Snippets

Common tasks and their implementations for quick reference.

---

## Search & Results

### Recipe 1: Listen for Search Completion

Listen to `asc:search:complete` and update a custom display:

```js
export default function decorate(block) {
  document.addEventListener('asc:search:complete', (e) => {
    const { results, total, size } = e.detail;
    const { assets, more } = results;
    
    if (assets.length === 0) {
      block.innerHTML = '<p>No assets found</p>';
      return;
    }
    
    block.innerHTML = `
      <h2>Results: ${total} assets</h2>
      <p>Showing ${size} of ${total}</p>
      ${assets.map(a => `<p>${a.getProperty('title')}</p>`).join('')}
      ${more ? '<button data-load-more>Load More</button>' : ''}
    `;
  });
}
```

### Recipe 2: Pre-Populate Search from URL

Restore search filters from URL query params on page load:

```js
export default function decorate(block) {
  // Read current URL params
  const params = new URLSearchParams(window.location.search);
  
  // Set form inputs to match params
  const form = document.getElementById('asc-search-form');
  params.forEach((value, key) => {
    const input = form.querySelector(`[name="${key}"]`);
    if (input?.type === 'checkbox') {
      input.checked = value === 'on' || value === 'true';
    } else if (input?.type === 'radio') {
      form.querySelector(`[name="${key}"][value="${value}"]`)?.click();
    } else {
      input.value = value;
    }
  });
  
  // Trigger search with restored state
  form.dispatchEvent(new CustomEvent('asc:search:execute', { bubbles: true }));
}
```

### Recipe 3: Get Total Search Results Count

Show "Showing N of M" stats:

```js
export default function decorate(block) {
  document.addEventListener('asc:search:complete', (e) => {
    const { total, size } = e.detail.results;
    block.querySelector('[data-stats]').innerHTML = `Showing ${size} of ${total}`;
  });
}
```

---

## Collections & Cart

### Recipe 4: Add Asset to Collection

```js
const button = block.querySelector('[data-add]');
button.addEventListener('click', async () => {
  const assetId = button.dataset.assetId;
  
  try {
    await services.collections.addAsset(assetId);
    button.textContent = '✓ Added';
  } catch (err) {
    console.error('Failed to add asset:', err);
  }
});
```

### Recipe 5: Show Collection Count

Display active collection size:

```js
export default async function decorate(block) {
  const collection = await services.collections.getActive();
  const count = collection?.assetIds?.length ?? 0;
  
  block.innerHTML = `<span class="badge">${count}</span>`;
  
  // Update when collection changes
  document.body.addEventListener('asc:collection:change', async () => {
    const updated = await services.collections.getActive();
    block.querySelector('.badge').textContent = updated?.assetIds?.length ?? 0;
  });
}
```

### Recipe 6: List All Collections

```js
export default async function decorate(block) {
  const collections = await services.collections.getAll();
  
  block.innerHTML = `
    <ul>
      ${collections.map(c => `
        <li>
          ${c.name} (${c.assetIds.length} items)
          <button data-collection="${c.id}">Use</button>
        </li>
      `).join('')}
    </ul>
  `;
  
  block.addEventListener('click', async (e) => {
    if (e.target.dataset.collection) {
      services.collections.setActive(e.target.dataset.collection);
    }
  });
}
```

### Recipe 7: Download Collection

```js
const button = block.querySelector('[data-download]');
button.addEventListener('click', async () => {
  const collection = await services.collections.getActive();
  if (!collection?.assetIds.length) return;
  
  // Get asset paths
  const paths = await Promise.all(
    collection.assetIds.map(id => services.search.getAssetById(id))
  ).then(assets => assets.map(a => a.path));
  
  // Initiate download
  const jobId = await services.downloads.create(paths, ['web', 'original']);
  
  // Listen for completion
  document.body.addEventListener('asc:download:complete', (e) => {
    if (e.detail.jobId === jobId) {
      alert('Download ready!');
    }
  });
});
```

---

## Modals & Fragments

### Recipe 8: Open Fragment in Modal

```js
import { loadFragment } from '../../scripts/asc/utils/fragments.js';

const button = block.querySelector('button');
button.addEventListener('click', async () => {
  const dialog = document.createElement('dialog');
  dialog.className = 'asc-dialog';
  dialog.innerHTML = '<div class="asc-dialog__body">Loading...</div>';
  document.body.append(dialog);
  dialog.showModal();
  
  try {
    const fragment = await loadFragment('/my-fragment');
    dialog.replaceChildren(fragment);
  } catch (err) {
    dialog.innerHTML = '<div class="asc-dialog__body">Error loading fragment</div>';
  }
  
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
});
```

### Recipe 9: Confirmation Dialog

```js
function confirm(title, message) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'asc-dialog';
    dialog.innerHTML = `
      <h2 class="asc-dialog__title">${title}</h2>
      <div class="asc-dialog__body">${message}</div>
      <footer class="asc-dialog__footer">
        <button class="btn btn--secondary" data-no>Cancel</button>
        <button class="btn btn--primary" data-yes>Confirm</button>
      </footer>
    `;
    
    dialog.querySelector('[data-yes]').onclick = () => {
      resolve(true);
      dialog.close();
    };
    
    dialog.querySelector('[data-no]').onclick = () => {
      resolve(false);
      dialog.close();
    };
    
    document.body.append(dialog);
    dialog.showModal();
  });
}

// Usage
if (await confirm('Delete', 'Are you sure?')) {
  deleteAsset();
}
```

### Recipe 10: Modal with Form

```js
const button = block.querySelector('button');
button.addEventListener('click', () => {
  const dialog = document.createElement('dialog');
  dialog.className = 'asc-dialog';
  dialog.innerHTML = `
    <h2 class="asc-dialog__title">Edit Asset</h2>
    <form class="asc-dialog__body">
      <label>Title: <input type="text" name="title" required></label>
      <label>Tags: <input type="text" name="tags"></label>
    </form>
    <footer class="asc-dialog__footer">
      <button class="btn btn--secondary" type="button" data-close>Cancel</button>
      <button class="btn btn--primary" type="submit" form="edit-form">Save</button>
    </footer>
  `;
  
  const form = dialog.querySelector('form');
  form.id = 'edit-form';
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    await saveAsset(data);
    dialog.close();
  });
  
  dialog.addEventListener('click', (e) => {
    if (e.target.dataset.close) dialog.close();
  });
  
  document.body.append(dialog);
  dialog.showModal();
});
```

---

## Assets & Details

### Recipe 11: Open Asset Details from ID

```js
const button = block.querySelector('button');
button.addEventListener('click', () => {
  const assetId = button.dataset.assetId;
  
  // Trigger asset details modal (via AssetDetails service)
  document.body.dispatchEvent(new CustomEvent('asc:asset:details:open', {
    detail: { data: { ascAsset: assetId } }
  }));
});
```

### Recipe 12: Fetch and Display Single Asset

```js
export default async function decorate(block) {
  const assetId = block.querySelector('[data-asset-id]').dataset.assetId;
  
  const asset = await services.search.getAssetById(assetId);
  if (!asset) {
    block.innerHTML = '<p>Asset not found</p>';
    return;
  }
  
  block.innerHTML = `
    <img src="${asset.getProperty('thumbnail')}" alt="${asset.getProperty('title')}">
    <h2>${asset.getProperty('title')}</h2>
    <p>${asset.getProperty('description') || 'No description'}</p>
    <ul>
      <li>Type: ${asset.getProperty('file-type')}</li>
      <li>Size: ${asset.getProperty('file-size')}</li>
      <li>Dimensions: ${asset.getProperty('dimensions')?.width}×${asset.getProperty('dimensions')?.height}</li>
    </ul>
  `;
}
```

### Recipe 13: Get Download URLs for Asset

```js
export default async function decorate(block) {
  const assetId = block.dataset.assetId;
  const asset = await services.search.getAssetById(assetId);
  
  const renditions = services.renditions.getRenditions(asset);
  
  block.innerHTML = `
    <ul>
      ${renditions.map(r => `
        <li><a href="${r.url}" download>${r.label}</a></li>
      `).join('')}
    </ul>
  `;
}
```

---

## Events & Communication

### Recipe 14: Listen for Asset Details Open

Track when users open asset details:

```js
export default function decorate(block) {
  document.body.addEventListener('asc:asset:details:open', (e) => {
    const { ascAsset } = e.detail.data;
    console.log('Asset details opened:', ascAsset);
    
    // Send analytics
    trackEvent('asset_details_opened', { assetId: ascAsset });
  });
}
```

### Recipe 15: Listen for Collection Changes

Update UI when collections change:

```js
export default function decorate(block) {
  document.body.addEventListener('asc:collection:change', (e) => {
    const { action, id, assetId } = e.detail;
    
    if (action === 'assetAdded') {
      console.log(`Asset ${assetId} added to ${id}`);
      block.querySelector('[data-count]').textContent = 'Updated!';
    } else if (action === 'activated') {
      console.log(`Collection switched to ${id}`);
      refreshCollectionDisplay();
    }
  });
}
```

### Recipe 16: Dispatch Custom Event

Send a custom event that other blocks listen for:

```js
export default function decorate(block) {
  block.querySelector('button').addEventListener('click', () => {
    // Fire custom event
    document.body.dispatchEvent(new CustomEvent('my:custom:event', {
      detail: { data: { myProp: 'value' } }
    }));
  });
}

// Listener (in another block)
document.body.addEventListener('my:custom:event', (e) => {
  console.log('Event received:', e.detail.data.myProp);
});
```

---

## Utilities

### Recipe 17: Get Asset from Block Context

Most blocks get the asset from the parent `<main>` element:

```js
import { createOptimizedPicture } from '../../scripts/aem.js';

export default async function decorate(block) {
  // Asset is in parent <main>
  const main = block.closest('main');
  const assetId = main?.dataset.ascAsset;
  
  if (!assetId) {
    console.warn('No asset context');
    return;
  }
  
  const asset = await services.search.getAssetById(assetId);
  // ...
}
```

### Recipe 18: Format File Size

```js
function formatFileSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

// Or use asset.getProperty('file-size') — already formatted
```

### Recipe 19: Wait for Image Load

```js
function waitForImageLoad(img) {
  return new Promise((resolve, reject) => {
    if (img.complete) {
      resolve();
    } else {
      img.onload = resolve;
      img.onerror = reject;
    }
  });
}

// Usage
await waitForImageLoad(imgElement);
```

### Recipe 20: Debounce Search Input

Prevent too many search requests while user types:

```js
import { debounce } from '../../scripts/asc/utils/timing.js'; // or create one

export default function decorate(block) {
  const input = block.querySelector('input');
  
  const debouncedSearch = debounce(() => {
    document.dispatchEvent(new CustomEvent('asc:search:execute'));
  }, 300);  // Wait 300ms after user stops typing
  
  input.addEventListener('input', debouncedSearch);
}
```

---

All recipes follow ASC conventions. Mix and match or adapt for your use case. See the full reference docs for more context on each feature.
