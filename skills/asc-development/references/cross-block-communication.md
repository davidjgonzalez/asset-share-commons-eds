# Cross-Block Communication via Events

How blocks communicate and coordinate without direct imports or tight coupling.

---

## The Event System

ASC uses the `asc:{noun}:{verb}` event naming pattern dispatched on `document` or `document.body`. Blocks listen for events from other blocks and services via `addEventListener()`.

---

## Event Scopes

| Scope | Used for | Example events |
|-------|----------|---|
| `document` | Search-wide coordination | `asc:search:execute`, `asc:search:complete` |
| `document.body` | Cross-block & service events | `asc:asset:details:open`, `asc:collection:add`, `asc:download:started` |
| Block element (rare) | Block-internal coordination | Event delegated to a specific block only |

---

## Declarative Events via Data Attributes

### `data-asc-action="noun:verb@event"`

The simplest way to send an event is declaratively in HTML. No JS wiring needed.

```html
<!-- Fires asc:asset:details:open on click -->
<div data-asc-action="asset:details:open@click" data-asc-asset="uuid-here">
  Click me
</div>

<!-- Fires asc:collection:add on click -->
<button data-asc-action="collection:add@click" 
        data-asc-asset="uuid-here"
        data-asc-collection="collection-id">
  Add to collection
</button>

<!-- Multiple events from one element -->
<article data-asc-action="asset:details:open@click asset:preload@mouseover"
         data-asc-asset="uuid-here">
  Hover for preload, click to open
</article>
```

### How It Works

The **Actions service** (in `scripts/asc/services/actions/actions.js`) listens globally on `document.body`. When it sees a click/mouseover/other event on an element with `data-asc-action`:

1. Parse the action: `"asset:details:open"` → dispatch `asc:asset:details:open`
2. Collect all `data-asc-*` attributes up the DOM tree (parents and ancestors)
3. Fire a `CustomEvent` on `document.body` with `detail.data` containing all collected attributes

```js
// Dispatched as:
document.body.dispatchEvent(new CustomEvent('asc:asset:details:open', {
  detail: { data: { ascAsset: 'uuid-here', ascCollection: 'col-id' } }
}));
```

### Data Attribute Propagation

Attributes bubble up the DOM tree and are collected:

```html
<div data-asc-collection="my-collection">
  <section>
    <button data-asc-action="collection:add@click" data-asc-asset="asset-uuid">
      Add
    </button>
  </section>
</div>
```

When the button is clicked:
- `data-asc-asset="asset-uuid"` → from the button itself
- `data-asc-collection="my-collection"` → from the ancestor `<div>`

Both are collected and passed in `event.detail.data`.

---

## Listening to Events (Imperative)

For complex logic, listen to events in JavaScript:

```js
// Listen for search completion
document.addEventListener('asc:search:complete', (event) => {
  const { results, total, formData } = event.detail;
  console.log(`Found ${total} assets`);
  // Do something with results
});

// Listen for collection changes
document.body.addEventListener('asc:collection:change', (event) => {
  const { action, id, assetId } = event.detail;
  if (action === 'assetAdded') {
    console.log(`Asset ${assetId} added to collection ${id}`);
  }
});

// Listen for asset details opening
document.body.addEventListener('asc:asset:details:open', (event) => {
  const { ascAsset } = event.detail.data;
  console.log(`User opened asset ${ascAsset}`);
});
```

### Event Detail Shapes

Each event passes a specific `detail` object. Full reference: [asc-event-reference.md](asc-event-reference.md)

---

## Dispatching Events Programmatically

In a block, dispatch an event to trigger cross-block behavior:

```js
export default function decorate(block) {
  const button = block.querySelector('button');
  
  button.addEventListener('click', () => {
    // Fire asc:asset:share event for handlers to intercept
    document.body.dispatchEvent(new CustomEvent('asc:asset:share', {
      detail: { data: { ascAsset: 'uuid-123' } }
    }));
  });
}
```

But prefer `data-asc-action` when possible — it's more maintainable.

---

## Common Patterns

### Pattern 1: Block Listens to Search Results

```js
// A custom block that shows asset stats when search completes
export default function decorate(block) {
  document.addEventListener('asc:search:complete', (event) => {
    const { results, total } = event.detail;
    block.innerHTML = `
      <p>Found ${total} assets</p>
      <p>Showing ${results.assets.length}</p>
    `;
  });
}
```

### Pattern 2: Collection Toggle (Reactive)

The `collectionToggle` Part listens to `asc:collection:change` and updates its UI (button text, state) automatically when any collection event fires. No wiring needed.

```js
// In a block, use the Part:
import collectionToggle from '../../scripts/asc/parts/collection-toggle/collection-toggle.js';

export default function decorate(block) {
  const asset = /* ... */;
  block.innerHTML = collectionToggle(asset);
  // collectionToggle automatically listens to asc:collection:change
  // and re-hydrates all instances on the page
}
```

### Pattern 3: Modal Opens on Asset Click

```html
<div data-asc-action="asset:details:open@click" data-asc-asset="uuid-here">
  <img src="..." alt="...">
  <h3>Asset Title</h3>
</div>
```

The AssetDetails service listens for `asc:asset:details:open`, opens a modal, and loads the appropriate details fragment based on MIME type.

### Pattern 4: Add to Collection

```html
<button data-asc-action="collection:add@click" 
        data-asc-asset="uuid"
        data-asc-collection="col-id">
  Add to collection
</button>
```

The Collections service listens for `asc:collection:add`, adds the asset to the collection, and dispatches `asc:collection:change` to notify all listeners (including the reactive toggle button).

---

## Event Dispatch Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  User interaction on HTML element                            │
│  (click, mouseover, etc.)                                     │
└──────────┬──────────────────────────────────────────────────┘
           │
           ├─ data-asc-action exists? YES
           │   │
           │   └─→ Actions service intercepts
           │       1. Parse action: noun:verb
           │       2. Collect data-asc-* attributes up DOM
           │       3. Dispatch CustomEvent on document.body
           │           asc:{noun}:{verb}
           │           { detail: { data: {...} } }
           │
           └─ Normal event listeners on element
               (if any)

           │
           ↓
┌─────────────────────────────────────────────────────────────┐
│  Service or block listening:                                 │
│  document.body.addEventListener('asc:...',[...])            │
│  or document.addEventListener('asc:...',[...])              │
│                                                              │
│  Event handler runs:                                         │
│  - Updates UI                                                │
│  - Calls services                                            │
│  - May dispatch more asc:* events                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Anti-Patterns

| Don't | Do |
|------|---|
| **Import block A into block B** | Use events; blocks should be independent |
| **Hardcode event names as strings** | Define event names in a constants file or near the dispatcher |
| **Dispatch on `document` when `document.body` is standard** | Use `document.body` for cross-block events (the convention) |
| **Forget to check `event.detail.data` for null values** | Always validate: `const { ascAsset } = event.detail?.data ?? {}`; provide defaults |
| **Dispatch the same event from multiple places with different payloads** | Keep the `detail` shape consistent; document in [asc-event-reference.md](asc-event-reference.md) |
| **Listen to events in a Part** | Parts return HTML strings; listen in blocks only. Parts update reactively via Part-level listeners (internal to the Part) |

---

## Debugging Events

### See all asc:* events in console

Add this to `scripts/delayed.js` or a debug block:

```js
document.addEventListener('asc:search:execute', (e) => console.log('asc:search:execute', e));
document.addEventListener('asc:search:complete', (e) => console.log('asc:search:complete', e));
document.body.addEventListener('asc:asset:details:open', (e) => console.log('asc:asset:details:open', e));
document.body.addEventListener('asc:collection:add', (e) => console.log('asc:collection:add', e));
document.body.addEventListener('asc:collection:change', (e) => console.log('asc:collection:change', e));
// ... etc
```

Then check the browser console tab and interact with the page.

### Verify data-asc-action is wired

```js
// In console:
document.querySelectorAll('[data-asc-action]').forEach(el => {
  console.log(el.dataset.ascAction, el.dataset);
});
```

Should list all elements with actions and their data attributes.

### Check if an event was dispatched

```js
// In console (before interacting):
window.dispatchedEvents = [];
const origDispatch = CustomEvent.prototype.constructor;
document.body.addEventListener('asc:collection:add', (e) => {
  window.dispatchedEvents.push({ type: e.type, detail: e.detail });
});

// Now interact. Check:
window.dispatchedEvents
```

---

## Full Event Reference

See [asc-event-reference.md](asc-event-reference.md) for the complete list of all 18+ ASC events, their payload shapes, and code examples.
