# Modals and Dialogs

How to build modals and dialogs using the native HTML `<dialog>` element and ASC conventions.

---

## Overview

ASC uses the native `<dialog>` element (available in all modern browsers). Apply the `.asc-dialog` CSS class for ASC styling.

```html
<dialog class="asc-dialog my-block__dialog" aria-labelledby="dialog-title">
  <h2 id="dialog-title" class="asc-dialog__title">Dialog Title</h2>
  <div class="asc-dialog__body">
    <!-- Content goes here -->
  </div>
  <footer class="asc-dialog__footer">
    <button class="btn btn--secondary" data-close-dialog>Cancel</button>
    <button class="btn btn--primary" id="confirm-btn">Confirm</button>
  </footer>
</dialog>
```

---

## Building a Modal Programmatically

### Step 1: Create and Configure

```js
const dialog = document.createElement('dialog');
dialog.className = 'asc-dialog my-block__dialog';

// Accessibility
dialog.setAttribute('aria-labelledby', 'my-dialog-title');
```

### Step 2: Add Content

```js
dialog.innerHTML = `
  <h2 id="my-dialog-title" class="asc-dialog__title">Confirm Delete</h2>
  <div class="asc-dialog__body">
    <p>Are you sure you want to delete this asset?</p>
    <p><strong>${asset.title}</strong></p>
  </div>
  <footer class="asc-dialog__footer">
    <button class="btn btn--secondary" data-close-dialog>Cancel</button>
    <button class="btn btn--danger" id="delete-btn">Delete</button>
  </footer>
`;
```

### Step 3: Add to DOM

```js
document.body.append(dialog);
```

### Step 4: Show Modal

```js
dialog.showModal();
```

### Step 5: Wire Event Listeners

```js
// Close button
dialog.addEventListener('click', (e) => {
  if (e.target.closest('[data-close-dialog]')) {
    dialog.close();
  }
});

// Confirm button
dialog.querySelector('#delete-btn').addEventListener('click', () => {
  deleteAsset(asset);
  dialog.close();
});

// ESC key closes automatically (native behavior)
```

---

## CSS Classes and Structure

### Base Class

```css
dialog.asc-dialog { }
```

### Structural Classes

| Class | Element | Purpose |
|-------|---------|---------|
| `.asc-dialog__title` | `<h2>` | Modal heading |
| `.asc-dialog__body` | `<div>` | Modal content area |
| `.asc-dialog__footer` | `<footer>` | Button footer |

```html
<dialog class="asc-dialog">
  <h2 class="asc-dialog__title">Title</h2>
  <div class="asc-dialog__body">Content</div>
  <footer class="asc-dialog__footer">
    <button>Action</button>
  </footer>
</dialog>
```

### Button Styles

Use `.btn` utility classes for modal buttons:

```html
<footer class="asc-dialog__footer">
  <button class="btn btn--secondary" data-close-dialog>Cancel</button>
  <button class="btn btn--primary">Confirm</button>
  <button class="btn btn--danger">Delete</button>
</footer>
```

---

## Backdrop and Focus

### Backdrop

The backdrop (dark overlay behind the modal) is styled globally in `styles/styles.css`:

```css
dialog::backdrop {
  background: rgba(0, 0, 0, 0.5);
  /* Already defined; no need to override */
}
```

### Closing on Backdrop Click

```js
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) {  // Click outside content
    dialog.close();
  }
});
```

### Focus Management

Focus shifts to the modal when `showModal()` is called. On close, focus returns to the previously focused element (automatic).

To autofocus a specific element:

```html
<button class="btn btn--primary" autofocus>Confirm</button>
```

---

## Loading Fragment Content into Modal

Combine `loadFragment()` with modals to load dynamic content:

```js
import { loadFragment } from '../../scripts/asc/core/utils/fragments.js';

export default function decorate(block) {
  const button = block.querySelector('button');
  
  button.addEventListener('click', async () => {
    // Create modal
    const dialog = document.createElement('dialog');
    dialog.className = 'asc-dialog';
    dialog.innerHTML = '<div class="asc-dialog__body" data-loading>Loading...</div>';
    document.body.append(dialog);
    dialog.showModal();
    
    try {
      // Load fragment
      const content = await loadFragment('/path/to/fragment');
      dialog.querySelector('[data-loading]').replaceWith(content);
    } catch (err) {
      dialog.querySelector('[data-loading]').innerHTML = 'Failed to load';
    }
    
    // Close button
    dialog.addEventListener('click', (e) => {
      if (e.target.closest('[data-close-dialog]')) dialog.close();
    });
  });
}
```

---

## Example: Asset Details Modal

The `details-modal` block demonstrates all these patterns:

```js
// Simplified:
const dialog = document.createElement('dialog');
dialog.className = 'asc-dialog details-modal__dialog';
dialog.setAttribute('aria-labelledby', 'asset-title');

// Load the fragment (e.g. /details or /details/image)
const content = await loadFragment(detailsPath);
dialog.append(content);

// Close on backdrop click
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) dialog.close();
});

// Close on ESC (automatic with showModal)
// Close on URL change (handled by asset-details service)

document.body.append(dialog);
dialog.showModal();
```

---

## Common Patterns

### Pattern 1: Confirmation Dialog

```js
function confirmDelete(asset) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.innerHTML = `
      <div class="asc-dialog__body">
        <p>Delete <strong>${asset.title}</strong>?</p>
      </div>
      <footer class="asc-dialog__footer">
        <button class="btn btn--secondary" data-no>Cancel</button>
        <button class="btn btn--danger" data-yes>Delete</button>
      </footer>
    `;
    
    dialog.querySelector('[data-yes]').addEventListener('click', () => {
      resolve(true);
      dialog.close();
    });
    
    dialog.querySelector('[data-no]').addEventListener('click', () => {
      resolve(false);
      dialog.close();
    });
    
    document.body.append(dialog);
    dialog.showModal();
  });
}

// Usage
if (await confirmDelete(asset)) {
  deleteAsset(asset);
}
```

### Pattern 2: Form in Modal

```js
const dialog = document.createElement('dialog');
dialog.className = 'asc-dialog';
dialog.innerHTML = `
  <div class="asc-dialog__body">
    <form id="edit-form">
      <label>Title</label>
      <input type="text" name="title" required>
      
      <label>Description</label>
      <textarea name="description"></textarea>
    </form>
  </div>
  <footer class="asc-dialog__footer">
    <button class="btn btn--secondary" data-close-dialog>Cancel</button>
    <button class="btn btn--primary" form="edit-form">Save</button>
  </footer>
`;

dialog.addEventListener('submit', (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  saveData(formData);
  dialog.close();
});

document.body.append(dialog);
dialog.showModal();
```

### Pattern 3: Non-Modal Dialog (Small overlay, doesn't grab focus)

```js
const dialog = document.createElement('dialog');
dialog.className = 'asc-dialog my-popover';
dialog.innerHTML = `<p>This is a tooltip</p>`;

// Non-modal: use show() instead of showModal()
dialog.show();

// Position near a trigger element
const rect = triggerElement.getBoundingClientRect();
dialog.style.position = 'fixed';
dialog.style.top = (rect.bottom + 10) + 'px';
dialog.style.left = rect.left + 'px';

// Close on click outside
document.addEventListener('click', (e) => {
  if (!dialog.contains(e.target) && e.target !== triggerElement) {
    dialog.close();
  }
});
```

---

## Accessibility

### Required Attributes

```html
<dialog aria-labelledby="dialog-title" aria-modal="true">
  <h2 id="dialog-title">Title</h2>
  <!-- ... -->
</dialog>
```

- `aria-labelledby` → points to the `id` of the heading
- `aria-modal="true"` → announces it's a modal to screen readers

### Focus Management

- `autofocus` on the primary action button
- Focus is trapped inside the modal (browser default)
- Focus returns to triggering element when closed (automatic)

### ESC Key

Close on ESC is automatic with `showModal()`. Do not prevent it.

---

## Anti-Patterns

| Don't | Do |
|------|---|
| **Use `<div role="dialog">`** | Use native `<dialog>` element — better accessibility, simpler API |
| **Prevent ESC key close** | Let ESC work — users expect it |
| **Show with `.show()` when you need modal behavior** | Use `.showModal()` for modal; `.show()` for non-modal overlay |
| **Create modal with `position: fixed; display: block`** | Use `<dialog>` element and `showModal()` — handles backdrop and focus |
| **Add `data-close-dialog` to non-button elements** | Close buttons should be semantic `<button>` elements |
| **Forget `aria-labelledby`** | Always point to the modal title for accessibility |
| **Load large fragments without loading state** | Show spinner / loading text while `loadFragment()` is pending |

---

## Browser Support

The native `<dialog>` element is supported in all modern browsers (Chrome 37+, Firefox 98+, Safari 15.4+, Edge 79+). No polyfill needed for current deployments.

For older browser support, see the [Open UI `<dialog>` polyfill](https://github.com/GoogleChrome/dialog-polyfill).

---

## Complete Example

```js
/** @owner user */
export default function decorate(block) {
  block.querySelector('button').addEventListener('click', openOptionsModal);
}

function openOptionsModal() {
  const dialog = document.createElement('dialog');
  dialog.className = 'asc-dialog';
  dialog.setAttribute('aria-labelledby', 'options-title');
  
  dialog.innerHTML = `
    <h2 id="options-title" class="asc-dialog__title">Options</h2>
    <div class="asc-dialog__body">
      <label>
        <input type="checkbox" name="show-thumbnails"> Show thumbnails
      </label>
      <label>
        <input type="checkbox" name="group-by-type"> Group by type
      </label>
    </div>
    <footer class="asc-dialog__footer">
      <button class="btn btn--secondary" data-close-dialog>Cancel</button>
      <button class="btn btn--primary" data-apply>Apply</button>
    </footer>
  `;
  
  // Apply settings
  dialog.querySelector('[data-apply]').addEventListener('click', () => {
    const form = dialog.querySelector('form') || dialog;
    const showThumbs = form.querySelector('[name="show-thumbnails"]').checked;
    const groupByType = form.querySelector('[name="group-by-type"]').checked;
    applySettings({ showThumbs, groupByType });
    dialog.close();
  });
  
  // Close on backdrop click or [data-close-dialog]
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.closest('[data-close-dialog]')) {
      dialog.close();
    }
  });
  
  // Remove from DOM when closed
  dialog.addEventListener('close', () => {
    dialog.remove();
  });
  
  document.body.append(dialog);
  dialog.showModal();
}
```

---

See also: [fragments.md](fragments.md) for loading content into modals.
