// ASC Core — do not edit. Customize via scripts/asc/configurations.js
//
// Ctrl/Cmd+click toggles one item; Shift+click range-selects from the last
// explicitly clicked item. Any results view opts in for free just by giving
// each item's outermost element a `data-asc-asset` attribute — the same
// contract asset:details:open, drag-and-drop, and resolveAssetFor() already
// rely on. Nested `data-asc-asset` elements (favorite/collection toggles,
// quick-action buttons) are automatically excluded since they aren't the
// topmost match within the container.

const registry = new WeakMap();

function isTopLevelItem(el, root) {
  let node = el.parentElement;
  while (node && node !== root) {
    if (node.matches('[data-asc-asset]')) return false;
    node = node.parentElement;
  }
  return true;
}

function getItems(root) {
  return [...root.querySelectorAll('[data-asc-asset]')].filter((el) => isTopLevelItem(el, root));
}

function itemFor(root, target) {
  const el = target.closest('[data-asc-asset]');
  return el && isTopLevelItem(el, root) ? el : null;
}

function applyState(el, isSelected) {
  el.classList.toggle('asc-ui-selected', isSelected);
  el.setAttribute('aria-selected', String(isSelected));
}

/**
 * Enables ctrl/cmd (toggle) + shift (range) multi-select on any container of
 * `data-asc-asset` items.
 *
 * @param {Element} root
 * @returns {{ getSelected: () => Set<string>, clear: () => void, selectAll: () => void }}
 *   getSelected() returns the current selection as a Set of asset UUIDs.
 *   clear() deselects everything (call after a bulk action, or on any render
 *   that replaces the container's items).
 *   selectAll() selects every currently-loaded top-level item.
 *
 * Fires `asc:selection:change` (bubbling) on `root` with
 * `{ selected: Set<string> }` whenever the selection changes.
 */
export function initSelection(root) {
  if (registry.has(root)) return registry.get(root);

  const selected = new Set();
  let anchor = null;

  function setSelected(el, isSelected) {
    const id = el.dataset.ascAsset;
    if (isSelected) selected.add(id); else selected.delete(id);
    applyState(el, isSelected);
  }

  function emitChange() {
    root.dispatchEvent(new CustomEvent('asc:selection:change', {
      bubbles: true,
      detail: { selected: new Set(selected) },
    }));
  }

  function clear() {
    getItems(root).forEach((el) => applyState(el, false));
    selected.clear();
    anchor = null;
    emitChange();
  }

  function selectAll() {
    getItems(root).forEach((el) => setSelected(el, true));
    anchor = null;
    emitChange();
  }

  root.addEventListener('click', (event) => {
    if (!event.ctrlKey && !event.metaKey && !event.shiftKey) return;
    const el = itemFor(root, event.target);
    if (!el) return;

    event.preventDefault();
    event.stopPropagation();

    const items = getItems(root);
    const id = el.dataset.ascAsset;

    if (event.shiftKey && anchor) {
      const ids = items.map((item) => item.dataset.ascAsset);
      const from = ids.indexOf(anchor);
      const to = ids.indexOf(id);
      if (from !== -1 && to !== -1) {
        const [start, end] = from < to ? [from, to] : [to, from];
        items.slice(start, end + 1).forEach((item) => setSelected(item, true));
      }
    } else {
      setSelected(el, !selected.has(id));
      anchor = id;
    }

    emitChange();
  });

  const api = { getSelected: () => new Set(selected), clear, selectAll };
  registry.set(root, api);
  return api;
}
