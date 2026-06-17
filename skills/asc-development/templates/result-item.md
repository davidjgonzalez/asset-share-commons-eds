# Block Template: Custom Result Item Display

Step-by-step guide to creating a custom block for displaying individual search result items (alternatives to the built-in search-results block).

---

## When to Use This Template

You want to:
- Display search results in a unique custom layout (not the default cards/masonry/list)
- Show additional custom properties alongside standard ones
- Create a specialized result block for a specific asset type (e.g., product teaser vs. document teaser)
- Build a "featured result" carousel or featured item display

This template applies if:
- You're building a **new block** (not modifying an existing one)
- It displays **assets from search results**
- It uses the `asc:search:complete` event
- You're following CDD

---

## File Structure

```
blocks/my-result-item/
  my-result-item.js       ← Block logic
  my-result-item.css      ← Styles (scoped to .block.my-result-item)
```

---

## Step 1: Define the Content Model

What does an author configure in da.live?

```
Block name: my-result-item
Properties:
  | property              | example value      | Description |
  | title                 | Featured Result    | Block title |
  | showThumbnail         | Yes                | Display image? |
  | showProperties        | Title, File Type   | Comma-separated properties to show |
  | highlightColor        | primary            | primary \| accent \| destructive |
  | maxTitleLength        | 50                 | Truncate title to N chars |
  | link                  | /details           | Link target on title (optional) |
```

**Example da.live table**:

```
| title                 | Featured Assets          |
| showThumbnail         | Yes                      |
| showProperties        | Title                    |
|                       | File Type                |
|                       | Modified                 |
| highlightColor        | primary                  |
| maxTitleLength        | 60                       |
```

---

## Step 2: Design HTML Structure

Sketch what a single result item looks like:

```html
<article class="my-result-item" data-asc-asset="uuid-123">
  <figure class="my-result-item__figure">
    <img 
      class="my-result-item__thumbnail" 
      src="https://..." 
      alt="Asset title"
      loading="lazy"
    >
  </figure>
  
  <div class="my-result-item__content">
    <h3 class="my-result-item__title">Asset Title</h3>
    
    <dl class="my-result-item__properties">
      <dt class="my-result-item__prop-label">Type</dt>
      <dd class="my-result-item__prop-value">JPEG</dd>
      
      <dt class="my-result-item__prop-label">Modified</dt>
      <dd class="my-result-item__prop-value">Jun 3, 2026</dd>
    </dl>
    
    <button 
      class="btn btn--primary my-result-item__action"
      data-asc-action="asset:details:open@click"
    >
      View Details
    </button>
  </div>
</article>
```

---

## Step 3: Write CSS

**File**: `blocks/my-result-item/my-result-item.css`

```css
.block.my-result-item {
  display: flex;
  gap: var(--spacing-lg);
  padding: var(--spacing-lg);
  background: var(--color-card);
  border: 2px solid var(--color-border);
  border-radius: var(--border-radius-m);
  transition: all var(--transition-normal);
}

/* Hover state */
.block.my-result-item:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
}

/* Thumbnail */
.my-result-item__figure {
  flex-shrink: 0;
  width: 120px;
  height: 120px;
  margin: 0;
  padding: 0;
  background: var(--color-muted);
  border-radius: var(--border-radius-m);
  overflow: hidden;
}

.my-result-item__thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Content */
.my-result-item__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

/* Title */
.my-result-item__title {
  margin: 0;
  font-size: var(--heading-font-size-m);
  color: var(--color-fg);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* Properties */
.my-result-item__properties {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--spacing-xs) var(--spacing-sm);
  margin: 0;
  padding: 0;
  font-size: var(--body-font-size-s);
}

.my-result-item__prop-label {
  font-weight: 600;
  color: var(--color-muted-fg);
}

.my-result-item__prop-value {
  margin: 0;
  color: var(--color-fg);
}

/* Action button */
.my-result-item__action {
  align-self: flex-start;
  margin-top: auto;  /* Push button to bottom */
}

/* Responsive: mobile -> stacked */
@media (width < 768px) {
  .block.my-result-item {
    flex-direction: column;
    padding: var(--spacing-md);
  }
  
  .my-result-item__figure {
    width: 100%;
    height: 200px;
  }
}

/* Variant: highlight color */
.block.my-result-item &.highlight-accent {
  border-color: var(--color-accent);
  background: var(--color-accent);
}

.block.my-result-item &.highlight-destructive {
  border-color: var(--color-destructive);
  background: rgba(var(--color-destructive), 0.1);
}
```

---

## Step 4: Implement JavaScript

**File**: `blocks/my-result-item/my-result-item.js`

```js
/** @owner user */
/**
 * my-result-item — Custom result item display for featured assets.
 * 
 * Authoring model (da.live):
 *   | property        | value                | Description |
 *   | title           | Featured Assets      | Block title |
 *   | showThumbnail   | Yes                  | Display image? |
 *   | showProperties  | Title\nFile Type     | Properties to show (newline-separated) |
 *   | highlightColor  | primary              | Border highlight color |
 * 
 * Listens to:
 *   - asc:search:complete → displays first result (or latest)
 * 
 * Rendered as:
 *   - Single <article> with asset properties
 *   - data-asc-asset used for click actions
 */

import { readBlockConfig } from '../../scripts/aem.js';

const DEFAULT_PROPERTIES = ['title', 'file-type', 'file-size'];

export default function decorate(block) {
  const config = readBlockConfig(block, {
    showProperties: (content) => {
      // Parse newline-separated properties
      return Array.isArray(content)
        ? content
        : String(content)
          .split('\n')
          .map(p => p.trim().toLowerCase())
          .filter(p => p);
    },
  }, {
    title: 'Featured Result',
    showThumbnail: 'Yes',
    showProperties: DEFAULT_PROPERTIES,
    highlightColor: 'primary',
    maxTitleLength: 100,
  });

  // Apply highlight color variant
  if (config.highlightColor && config.highlightColor !== 'primary') {
    block.classList.add(`highlight-${config.highlightColor}`);
  }

  // Listen for search results
  document.addEventListener('asc:search:complete', (e) => {
    const { assets } = e.detail.results;

    if (assets.length === 0) {
      block.innerHTML = '<p>No results to display</p>';
      return;
    }

    // Display first result (could be last, random, etc.)
    const asset = assets[0];
    block.innerHTML = renderItem(asset, config);
  });

  // Show empty state initially
  block.innerHTML = '<p>Waiting for search results...</p>';
}

function renderItem(asset, config) {
  const title = asset.getProperty('title') ?? 'Untitled';
  const truncatedTitle = truncate(title, config.maxTitleLength);
  const thumbnail = asset.getProperty('thumbnail');
  const showThumb = config.showThumbnail?.toLowerCase() === 'yes';

  const propertiesHtml = (config.showProperties || DEFAULT_PROPERTIES)
    .map(propName => {
      const value = asset.getProperty(propName);
      if (!value) return '';

      // Friendly labels
      const labels = {
        'title': 'Title',
        'file-type': 'Type',
        'file-size': 'Size',
        'modified': 'Modified',
        'created': 'Created',
      };

      const label = labels[propName] || propName;
      return `
        <dt class="my-result-item__prop-label">${label}</dt>
        <dd class="my-result-item__prop-value">${value}</dd>
      `;
    })
    .join('');

  return `
    <article class="my-result-item" data-asc-asset="${asset.uuid}">
      ${showThumb && thumbnail ? `
        <figure class="my-result-item__figure">
          <img 
            class="my-result-item__thumbnail"
            src="${thumbnail}"
            alt="${title}"
            loading="lazy"
          >
        </figure>
      ` : ''}
      
      <div class="my-result-item__content">
        <h3 class="my-result-item__title">${truncatedTitle}</h3>
        
        ${propertiesHtml ? `
          <dl class="my-result-item__properties">
            ${propertiesHtml}
          </dl>
        ` : ''}
        
        <button 
          class="btn btn--primary my-result-item__action"
          data-asc-action="asset:details:open@click"
        >
          View Details
        </button>
      </div>
    </article>
  `;
}

function truncate(str, length) {
  if (str.length <= length) return str;
  return str.substring(0, length) + '…';
}
```

---

## Step 5: Testing

**On Static HTML**:
1. Create `blocks/my-result-item/my-result-item-static.html`
2. Mock an asset with sample data
3. Check CSS and layout on mobile/desktop
4. Get design review

**With Real Data**:
1. Run `aem up`
2. Create a search page with search filters + your custom result block
3. Perform a search
4. Verify first result displays correctly
5. Click "View Details" → opens modal
6. Test responsive (mobile/desktop)

**Edge Cases**:
- [ ] No search results → shows "No results to display"
- [ ] Asset has no thumbnail → gracefully hide image
- [ ] Asset missing properties → shows "—" or omits property
- [ ] Very long title → truncates with "…"
- [ ] Click asset → opens details modal
- [ ] Mobile < 768px → stacks vertically
- [ ] Keyboard Tab → focus visible on button

---

## Step 6: Customize Further

### Variant 1: Show Multiple Results

Instead of first result only, show all:

```js
document.addEventListener('asc:search:complete', (e) => {
  const { assets } = e.detail.results;

  if (assets.length === 0) {
    block.innerHTML = '<p>No results</p>';
    return;
  }

  // Show all results
  block.innerHTML = assets
    .map(asset => renderItem(asset, config))
    .join('');
});
```

Then adjust CSS for `.my-result-item` to display as grid:

```css
.block.my-result-item {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-lg);
}
```

### Variant 2: Add Custom Properties

Register a custom property in `configurations.js`:

```js
properties: {
  custom: {
    'brand': (asset) => asset.data.metadata['myco:brand'] || 'N/A',
  }
}
```

Then include in `showProperties`:

```
| showProperties | Title           |
|              | File Type       |
|              | Brand           |
|              | Modified        |
```

---

## Step 7: Documentation

Add to your block's JSDoc:

```js
/**
 * Custom result item display.
 * 
 * Features:
 *   - Displays featured asset from search results
 *   - Configurable properties display
 *   - Responsive mobile/desktop layout
 *   - Click to open asset details
 * 
 * Variants:
 *   - highlight-accent: Accent color border
 *   - highlight-destructive: Red border
 * 
 * Properties shown (customizable):
 *   - title: Asset title
 *   - file-type: Format (JPEG, PDF, etc.)
 *   - file-size: Formatted size
 *   - modified: Last modified date
 *   - created: Creation date
 * 
 * @author Your Name
 * @since 2026-06
 */
```

---

## Common Variations

### Show Last Result Instead of First

```js
const asset = assets[assets.length - 1];
```

### Show Random Result

```js
const asset = assets[Math.floor(Math.random() * assets.length)];
```

### Show Only Image Assets

```js
const imageAssets = assets.filter(a => 
  a.getProperty('mime-type')?.startsWith('image/')
);
const asset = imageAssets[0];
```

### Add More Metadata (Price, Rating, etc.)

```js
// In configurations.js, add custom property
properties: {
  custom: {
    'price': (asset) => asset.data.metadata['myapp:price'],
    'rating': (asset) => asset.data.metadata['myapp:rating'],
  }
}

// Then include in showProperties
```

---

## Troubleshooting

**Block shows "No results" even after search?**
- Check that search is completing (`asc:search:complete` fires)
- Log `e.detail.results.assets.length` in the event listener
- Verify search results page is on same domain

**Thumbnail not showing?**
- Check image URL: `asset.getProperty('thumbnail')`
- Verify CORS headers from AEM
- Check browser Network tab for 404

**Properties showing "undefined"?**
- Use optional chaining: `asset.getProperty('title') ?? 'N/A'`
- Check property name is lowercase
- See [parts.md](parts.md) for built-in property list

**Mobile layout is broken?**
- Check media query: `@media (width < 768px)` not `(max-width: 767px)`
- Verify `flex-direction: column` in mobile breakpoint
- Test in real mobile device (not just DevTools)

---

See also: [block-conventions.md](block-conventions.md), [cdd-workflow.md](cdd-workflow.md), [recipes.md](recipes.md#recipe-1-listen-for-search-completion)
