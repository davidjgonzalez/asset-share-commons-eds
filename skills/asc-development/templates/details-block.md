# Block Template: Custom Details Panel

Step-by-step guide to creating a custom block for displaying asset details panels (alternatives to built-in details-* blocks).

---

## When to Use This Template

You want to:
- Display additional metadata alongside standard asset details
- Create a specialized details view for a specific asset type (e.g., product details vs. document info)
- Add custom actions or workflows specific to your use case
- Create a "sidebar" details panel with custom layout

This template applies if:
- You're building a **new block** (not modifying an existing one)
- It displays **asset metadata and properties**
- The asset context comes from `data-asc-asset` on the parent `<main>`
- You're following CDD

---

## File Structure

```
blocks/my-details-panel/
  my-details-panel.js       ← Block logic
  my-details-panel.css      ← Styles (scoped to .block.my-details-panel)
```

---

## Step 1: Define the Content Model

What does an author configure in da.live?

```
Block name: my-details-panel
Properties:
  | property         | example value           | Description |
  | title            | Asset Information       | Panel title |
  | showProperties   | Title, Dimensions, Size | Comma-separated properties |
  | layout           | vertical (default)      | vertical | horizontal | grid |
  | backgroundColor  | muted                   | card | muted | primary |
  | showDownload     | Yes                     | Show download button? |
```

**Example da.live table**:

```
| title           | Asset Details           |
| showProperties  | Title                   |
|                 | Dimensions              |
|                 | File Size               |
|                 | File Type               |
|                 | Modified                |
| layout          | vertical                |
| showDownload    | Yes                     |
```

---

## Step 2: Design HTML Structure

Sketch what a details panel looks like:

```html
<div class="my-details-panel">
  <div class="my-details-panel__header">
    <h2 class="my-details-panel__title">Asset Details</h2>
  </div>
  
  <div class="my-details-panel__body">
    <dl class="my-details-panel__list">
      <!-- Property rows -->
      <dt class="my-details-panel__label">Title</dt>
      <dd class="my-details-panel__value">Asset Title Here</dd>
      
      <dt class="my-details-panel__label">Dimensions</dt>
      <dd class="my-details-panel__value">1920 × 1080</dd>
      
      <dt class="my-details-panel__label">File Size</dt>
      <dd class="my-details-panel__value">2.3 MB</dd>
      
      <dt class="my-details-panel__label">Modified</dt>
      <dd class="my-details-panel__value">Jun 3, 2026</dd>
    </dl>
  </div>
  
  <div class="my-details-panel__footer">
    <button class="btn btn--primary" data-asc-action="collection:add@click">
      Add to Collection
    </button>
    <button class="btn btn--secondary">Download</button>
  </div>
</div>
```

---

## Step 3: Write CSS

**File**: `blocks/my-details-panel/my-details-panel.css`

```css
.block.my-details-panel {
  display: flex;
  flex-direction: column;
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-m);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

/* Header */
.my-details-panel__header {
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-secondary);
}

.my-details-panel__title {
  margin: 0;
  font-size: var(--heading-font-size-m);
  color: var(--color-fg);
}

/* Body */
.my-details-panel__body {
  flex: 1;
  padding: var(--spacing-lg);
  overflow-y: auto;
  max-height: 400px;  /* Scrollable if many properties */
}

/* Property list */
.my-details-panel__list {
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--spacing-sm) var(--spacing-md);
  align-items: baseline;
}

.my-details-panel__label {
  font-weight: 600;
  color: var(--color-muted-fg);
  font-size: var(--body-font-size-s);
}

.my-details-panel__value {
  margin: 0;
  color: var(--color-fg);
  word-break: break-word;
}

/* Footer with actions */
.my-details-panel__footer {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  border-top: 1px solid var(--color-border);
  background: var(--color-secondary);
}

.my-details-panel__footer button {
  flex: 1;
}

/* Layout variant: horizontal (side-by-side) */
.block.my-details-panel &.layout-horizontal {
  & .my-details-panel__list {
    grid-template-columns: auto auto auto auto;
  }
}

/* Layout variant: grid (3 columns) */
.block.my-details-panel &.layout-grid {
  & .my-details-panel__list {
    grid-template-columns: 1fr 1fr 1fr;
    grid-auto-flow: dense;
  }
}

/* Background variant */
.block.my-details-panel &.bg-muted {
  & .my-details-panel__body {
    background: var(--color-muted);
  }
}

/* Loading state */
.my-details-panel__loading {
  padding: var(--spacing-lg);
  text-align: center;
  color: var(--color-muted-fg);
}

/* Error state */
.my-details-panel__error {
  padding: var(--spacing-lg);
  color: var(--color-destructive);
  background: rgba(var(--color-destructive), 0.1);
  border-radius: var(--border-radius-m);
}

/* Mobile responsive */
@media (width < 768px) {
  .block.my-details-panel {
    & .my-details-panel__footer {
      flex-direction: column;
    }
    
    & .my-details-panel__footer button {
      width: 100%;
    }
  }
}
```

---

## Step 4: Implement JavaScript

**File**: `blocks/my-details-panel/my-details-panel.js`

```js
/** @owner user */
/**
 * my-details-panel — Custom asset details display.
 * 
 * Authoring model (da.live):
 *   | property        | value          | Description |
 *   | title           | Asset Details  | Panel title |
 *   | showProperties  | Title\nSize    | Properties (newline-separated) |
 *   | layout          | vertical       | vertical | horizontal | grid |
 *   | showDownload    | Yes            | Show download button? |
 * 
 * Asset Context:
 *   Reads data-asc-asset from parent <main> element.
 *   The parent details-modal or details fragment sets this.
 * 
 * Listens to:
 *   (none — pure display of asset context)
 * 
 * Rendered as:
 *   - Definition list of properties
 *   - Optional download button
 * 
 * @author Your Name
 * @since 2026-06
 * @requires Asset model, readBlockConfig
 */

import { readBlockConfig } from '../../scripts/aem.js';
import Asset from '../../scripts/asc/models/asset.js';
import services from '../../scripts/asc/services/services.js';

const DEFAULT_PROPERTIES = ['title', 'file-type', 'file-size', 'modified'];

export default async function decorate(block) {
  const config = readBlockConfig(block, {
    showProperties: (content) => {
      return Array.isArray(content)
        ? content
        : String(content)
          .split('\n')
          .map(p => p.trim().toLowerCase())
          .filter(p => p);
    },
  }, {
    title: 'Asset Details',
    showProperties: DEFAULT_PROPERTIES,
    layout: 'vertical',
    showDownload: 'Yes',
  });

  // Apply layout variant
  if (config.layout !== 'vertical') {
    block.classList.add(`layout-${config.layout}`);
  }

  // Show loading
  block.innerHTML = '<div class="my-details-panel__loading">Loading...</div>';

  try {
    // Get asset from parent <main> context
    const asset = await Asset.create(block);

    if (!asset) {
      block.innerHTML = '<div class="my-details-panel__error">No asset found</div>';
      return;
    }

    // Render panel
    block.innerHTML = renderPanel(asset, config);
  } catch (err) {
    console.error('Error loading asset:', err);
    block.innerHTML = '<div class="my-details-panel__error">Error loading asset details</div>';
  }
}

function renderPanel(asset, config) {
  const propertiesHtml = renderProperties(asset, config);
  const downloadHtml = renderDownloadButton(asset, config);

  return `
    <div class="my-details-panel__header">
      <h2 class="my-details-panel__title">${config.title}</h2>
    </div>
    
    <div class="my-details-panel__body">
      <dl class="my-details-panel__list">
        ${propertiesHtml}
      </dl>
    </div>
    
    ${downloadHtml ? `
      <div class="my-details-panel__footer">
        <button 
          class="btn btn--primary"
          data-asc-action="collection:add@click"
          data-asc-asset="${asset.uuid}"
        >
          Add to Collection
        </button>
        ${downloadHtml}
      </div>
    ` : ''}
  `;
}

function renderProperties(asset, config) {
  const propertiesToShow = config.showProperties || DEFAULT_PROPERTIES;

  const labels = {
    'title': 'Title',
    'file-type': 'Type',
    'file-size': 'Size',
    'file-extension': 'Extension',
    'mime-type': 'MIME Type',
    'modified': 'Modified',
    'created': 'Created',
    'dimensions': 'Dimensions',
    'width': 'Width',
    'height': 'Height',
    'description': 'Description',
    'filename': 'Filename',
  };

  return propertiesToShow
    .map(propName => {
      const value = asset.getProperty(propName);

      if (!value) return '';

      // Special handling for dimensions
      let displayValue = value;
      if (propName === 'dimensions' && typeof value === 'object') {
        displayValue = `${value.width} × ${value.height}`;
      }

      const label = labels[propName] || propName;

      return `
        <dt class="my-details-panel__label">${label}</dt>
        <dd class="my-details-panel__value">${displayValue}</dd>
      `;
    })
    .filter(html => html)
    .join('');
}

function renderDownloadButton(asset, config) {
  if (config.showDownload?.toLowerCase() !== 'yes') {
    return '';
  }

  return `
    <button 
      class="btn btn--secondary"
      data-asc-action="asset:download@click"
      data-asc-asset="${asset.uuid}"
    >
      Download
    </button>
  `;
}
```

---

## Step 5: Testing

**Static HTML**:
1. Create `blocks/my-details-panel/my-details-panel-static.html`
2. Mock asset properties with sample data
3. Verify layout (vertical, horizontal, grid) looks correct
4. Check mobile responsive behavior

**With Real Asset**:
1. Run `aem up`
2. Create a details fragment page with your panel block
3. Open an asset details modal (`?asset={uuid}`)
4. Verify all properties display correctly
5. Click "Add to Collection" → should work
6. Click "Download" → should work

**Edge Cases**:
- [ ] Asset has no thumbnail → no error, just missing image
- [ ] Property is missing → omits row or shows "—"
- [ ] Very long property value → text wraps or truncates gracefully
- [ ] Mobile layout → buttons stack vertically
- [ ] Click Add to Collection → triggers event
- [ ] Keyboard Tab → can focus buttons, enter activates

---

## Step 6: Customize Further

### Add Custom Metadata

Register in `configurations.js`:

```js
properties: {
  custom: {
    'brand': (asset) => asset.data.metadata['myco:brand'] || 'N/A',
    'sku': (asset) => asset.data.metadata['myco:sku'],
  }
}
```

Then include in showProperties:

```
| showProperties | Title   |
|              | Brand   |
|              | SKU     |
|              | Size    |
```

### Add Custom Actions

Add buttons for your workflow:

```js
// In renderPanel():
function renderPanel(asset, config) {
  return `
    ...
    <div class="my-details-panel__footer">
      <button class="btn btn--primary" data-asc-action="collection:add@click">
        Add to Collection
      </button>
      <button class="btn btn--secondary" data-asset-action="approve">
        Approve
      </button>
      <button class="btn btn--secondary" data-asset-action="reject">
        Reject
      </button>
    </div>
  `;
}

// Listen for custom action
export default async function decorate(block) {
  // ... existing code ...
  
  block.addEventListener('click', (e) => {
    if (e.target.dataset.assetAction === 'approve') {
      approveAsset(asset);
    }
  });
}
```

### Conditional Properties Based on Asset Type

```js
function renderProperties(asset, config) {
  let propertiesToShow = config.showProperties || DEFAULT_PROPERTIES;
  
  // Add extra properties for videos
  if (asset.getProperty('mime-type')?.startsWith('video/')) {
    propertiesToShow = [
      ...propertiesToShow,
      'duration',  // custom property
      'codecs',    // custom property
    ];
  }
  
  // ... rest of rendering ...
}
```

---

## Step 7: Documentation

Add comprehensive JSDoc:

```js
/**
 * Custom details panel for asset properties.
 * 
 * Features:
 *   - Displays configurable asset properties
 *   - Layout variants: vertical, horizontal, grid
 *   - Action buttons: Add to Collection, Download
 *   - Responsive on mobile
 * 
 * Properties (customizable):
 *   - title: Asset name
 *   - file-type: Format (JPEG, PDF, etc.)
 *   - file-size: Formatted size
 *   - dimensions: Width × Height for images
 *   - modified: Last modified date
 *   - created: Creation date
 *   - description: Asset description
 * 
 * Custom properties:
 *   Register in configurations.js under properties.custom
 *   Then include in showProperties
 * 
 * Asset Context:
 *   Reads data-asc-asset from parent <main>
 *   Used in details-modal or details fragments
 * 
 * @author Your Name
 * @since 2026-06
 * @requires Asset, readBlockConfig, services
 */
```

---

## Common Variations

### Collapsible Sections

```js
// Group properties by category
const sections = {
  'General': ['title', 'description'],
  'Technical': ['file-type', 'file-size', 'dimensions'],
  'Dates': ['created', 'modified'],
};

// Render as collapsible <details> elements
Object.entries(sections).forEach(([section, props]) => {
  const html = `
    <details open>
      <summary>${section}</summary>
      <dl>...</dl>
    </details>
  `;
});
```

### Tabs (Multiple Views)

```js
const tabs = {
  'Details': ['title', 'file-type', 'file-size'],
  'Technical': ['mime-type', 'dimensions', 'color-space'],
  'Metadata': ['author', 'copyright', 'keywords'],
};

// Render tab buttons + panes
```

### Inline Editing

```js
// Make properties editable
const isEditing = block.classList.contains('edit-mode');

if (isEditing) {
  return `
    <input type="text" value="${asset.getProperty('title')}" 
           data-property="title" class="my-details-panel__input">
  `;
}
```

---

## Troubleshooting

**Block shows "No asset found"?**
- Check that parent `<main>` has `data-asc-asset="uuid"`
- Check console for errors calling `Asset.create()`
- Verify asset UUID is valid

**Properties showing "undefined"?**
- Use optional chaining: `asset?.getProperty(...) ?? 'N/A'`
- Check property name is lowercase
- See [services-api.md](services-api.md) for built-in properties

**Asset loads but properties don't display?**
- Check `showProperties` da.live table is formatted correctly
- Properties should be newline-separated (each on own line)
- Property names must be lowercase and match built-in or custom properties

**Buttons don't work?**
- Add `data-asc-asset="${asset.uuid}"` to button
- Use `data-asc-action` for standard actions (collection:add, asset:download)
- Custom actions need click listener in block

**Mobile layout is broken?**
- Check media query: `@media (width < 768px)` not `(max-width: 767px)`
- Verify buttons use `flex: 1` to fill footer
- Test in real mobile device

---

## File Size Optimization

If the details panel is large or contains many properties:

```js
// Lazy-load the panel on scroll into view
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting && !block.classList.has('loaded')) {
      loadAssetDetails(block);
      observer.unobserve(block);
    }
  });
});

observer.observe(block);
```

---

---

## Loading External Libraries from CDN

Some details blocks need a third-party library (e.g. a map renderer, a PDF viewer, a chart).
Use `loadCSS` / `loadScript` from `scripts/aem.js` — they de-duplicate loads and return Promises.

**Rules:**
- Load only when the block is present — never in `scripts.js` or globally
- Always `try/catch` the load so a CDN failure doesn't crash the page
- Provide a fallback (text, link, message) so the block degrades gracefully
- `loadCSS` is fire-and-forget (non-blocking); `await loadScript` before calling library APIs

```js
import { loadCSS, loadScript } from '../../scripts/aem.js';

const LIB_CSS = 'https://cdn.example.com/lib@1.0.0/lib.css';
const LIB_JS  = 'https://cdn.example.com/lib@1.0.0/lib.js';

export default async function decorate(block) {
  // ... get asset, validate data, render container HTML ...

  const container = block.querySelector('.my-block__container');

  try {
    loadCSS(LIB_CSS);          // non-blocking — CSS loads in parallel
    await loadScript(LIB_JS);  // wait for JS before calling library APIs
    initLibrary(container, data);
  } catch {
    // CDN failed — container already has fallback text/link from innerHTML above
    container.remove();
  }
}
```

**Reference implementation:** `blocks/details-map/details-map.js` — Leaflet + OpenStreetMap,
with `ResizeObserver` to handle sizing inside a `<dialog>` that was hidden at decoration time.

---

See also: [block-conventions.md](block-conventions.md), [cdd-workflow.md](cdd-workflow.md), [services-api.md](services-api.md), [recipes.md](recipes.md#recipe-12-fetch-and-display-single-asset)
