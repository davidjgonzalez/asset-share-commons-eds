// ASC Core — do not edit. Customize via scripts/asc/configurations.js

import { loadCSS } from '../../../../aem.js';
import services from '../../services/services.js';
import { Events } from '../../services/collections/collections.js';

loadCSS('/scripts/asc/core/parts/collection-toggle/collection-toggle.css');

// ── Reactive hydration ────────────────────────────────────────────────────────
//
// Registered once at module import — updates every .asc-collection-toggle on
// the page whenever the active collection changes (add, remove, switch, etc.).
// Uses microtask batching so rapid successive events collapse to one DOM pass.

let hydrationPending = false;

function scheduleHydration() {
  if (hydrationPending) return;
  hydrationPending = true;
  Promise.resolve().then(() => {
    hydrationPending = false;
    hydrateAll();
  });
}

async function hydrateAll() {
  const activeId = services.collections.getActiveId();
  const active = await services.collections.get(activeId);
  if (!active) return;

  const assetSet = new Set(active.assetIds);

  document.querySelectorAll('.asc-collection-toggle').forEach((el) => {
    const { ascAsset: assetId } = el.dataset;
    if (!assetId) return;

    const inCollection = assetSet.has(assetId);
    el.dataset.inCollection = String(inCollection);

    // Sync aria-pressed on each toggle button
    el.querySelectorAll('.asc-collection-toggle__btn').forEach((btn) => {
      const isAdd = btn.classList.contains('asc-collection-toggle__add');
      btn.setAttribute('aria-pressed', String(isAdd ? !inCollection : inCollection));
    });

    // Update label text: replace {name} token with the active collection name
    el.querySelectorAll('[data-label]').forEach((span) => {
      const resolved = span.dataset.label.replace('{name}', active.name);
      span.textContent = resolved;
      // Keep the parent button's aria-label in sync for screen readers
      if (span.parentElement) span.parentElement.setAttribute('aria-label', resolved);
    });
  });
}

document.addEventListener(Events.CHANGED, scheduleHydration);

// Hydrate existing and future toggles via MutationObserver.
// This covers: initial page load, lazy-loaded search result cards, and
// any other dynamic insertions without needing an explicit call site.
const observer = new MutationObserver((mutations) => {
  const hasNewToggles = mutations.some((m) => [...m.addedNodes].some(
    (n) => n.nodeType === 1
      && (n.classList?.contains('asc-collection-toggle') || n.querySelector?.('.asc-collection-toggle')),
  ));
  if (hasNewToggles) scheduleHydration();
});
observer.observe(document.body, { childList: true, subtree: true });

// ── Part ──────────────────────────────────────────────────────────────────────

/**
 * collectionToggle(asset, options) — add/remove collection toggle button.
 *
 * Renders both states simultaneously; CSS shows only the correct one based on
 * the `data-in-collection` attribute, which is resolved asynchronously on load
 * and updated on every `asc:collection:change` event.
 *
 * Label strings support a `{name}` token replaced with the active collection name.
 *
 * Usage:
 *   import collectionToggle from '.../collection-toggle/collection-toggle.js';
 *   container.insertAdjacentHTML('beforeend', collectionToggle(asset));
 *
 * @param {Asset}  asset
 * @param {object} [options]
 * @param {string} [options.addLabel='Add to {name}']       Label for the add button
 * @param {string} [options.removeLabel='Remove from {name}'] Label for the remove button
 * @param {string} [options.collectionId]                   Target a specific collection; omit for active
 * @returns {string} HTML string
 */
export default function collectionToggle(asset, options = {}) {
  const {
    addLabel = 'Add to {name}',
    removeLabel = 'Remove from {name}',
    collectionId = '',
  } = options;

  const collectionAttr = collectionId ? ` data-asc-collection="${escAttr(collectionId)}"` : '';

  return `<div class="asc-collection-toggle"
              data-asc-asset="${escAttr(asset.uuid)}"
              data-in-collection="">
    <button class="asc-collection-toggle__btn asc-collection-toggle__add"
            data-asc-action="collection:add@click"
            data-asc-stop="true"
            data-asc-asset="${escAttr(asset.uuid)}"${collectionAttr}
            aria-pressed="false"
            type="button">
      <span class="asc-collection-toggle__icon" aria-hidden="true">+</span>
      <span class="asc-collection-toggle__label" data-label="${escAttr(addLabel)}"
            >Add to collection</span>
    </button>
    <button class="asc-collection-toggle__btn asc-collection-toggle__remove"
            data-asc-action="collection:remove@click"
            data-asc-stop="true"
            data-asc-asset="${escAttr(asset.uuid)}"${collectionAttr}
            aria-pressed="false"
            type="button">
      <span class="asc-collection-toggle__icon" aria-hidden="true">−</span>
      <span class="asc-collection-toggle__label" data-label="${escAttr(removeLabel)}"
            >Remove from collection</span>
    </button>
  </div>`;
}

function escAttr(str) {
  return String(str ?? '').replace(/"/g, '&quot;');
}
