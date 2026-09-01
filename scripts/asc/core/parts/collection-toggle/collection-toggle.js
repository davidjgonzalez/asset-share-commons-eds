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
//
// Each toggle carries its own target collection ID (`data-asc-collection` on the
// root — omitted means "the active collection"), so a page can mix an implicit
// "add to active collection" toggle with an explicit one (e.g. the favorite
// toggle, which always targets the default collection) and each is hydrated
// against its own target, not a single page-wide active collection.

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
  const toggles = [...document.querySelectorAll('.asc-collection-toggle')];
  if (!toggles.length) return;

  const activeId = services.collections.getActiveId();
  const defaultId = services.collections.getDefaultId();
  const favoriteActive = activeId === defaultId;

  const targetIds = new Set(toggles.map((el) => el.dataset.ascCollection || activeId));
  const targets = new Map(
    await Promise.all([...targetIds].map(async (id) => [id, await services.collections.get(id)])),
  );

  toggles.forEach((el) => {
    const { ascAsset: assetId } = el.dataset;
    if (!assetId) return;

    // The plain "add to whatever's active" toggle is redundant with the favorite
    // toggle once the active collection IS the favorite (default) one — both
    // would target the same collection, so hide the generic one to avoid two
    // controls doing the identical thing side by side. Set both `hidden` (semantic,
    // and enough on its own in most contexts) AND an inline `display: none` —
    // consumer CSS for this part routinely sets `display` on `.asc-collection-toggle`
    // at higher specificity than the UA `[hidden]` rule (e.g. search-results.css's
    // card/masonry override), which would otherwise silently keep it visible to
    // both sighted users and assistive tech despite `hidden` being set.
    if (el.classList.contains('asc-collection-toggle--generic')) {
      el.hidden = favoriteActive;
      el.style.display = favoriteActive ? 'none' : '';
      if (favoriteActive) return;
    }

    const target = targets.get(el.dataset.ascCollection || activeId);
    if (!target) return;

    const inCollection = target.assetIds.includes(assetId);
    el.dataset.inCollection = String(inCollection);

    // Sync aria-pressed on each toggle button
    el.querySelectorAll('.asc-collection-toggle__btn').forEach((btn) => {
      const isAdd = btn.classList.contains('asc-collection-toggle__add');
      btn.setAttribute('aria-pressed', String(isAdd ? !inCollection : inCollection));
    });

    // Update label text: replace {name} token with the toggle's target collection name
    el.querySelectorAll('[data-label]').forEach((span) => {
      const resolved = span.dataset.label.replace('{name}', target.name);
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

// ── Icons ───────────────────────────────────────────────────────────────────────

const ICONS = {
  add: '+',
  remove: '&minus;',
  star: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  starFilled: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
};

// ── Part ──────────────────────────────────────────────────────────────────────

/**
 * collectionToggle(asset, options) — add/remove collection toggle button.
 *
 * Renders both states simultaneously; CSS shows only the correct one based on
 * the `data-in-collection` attribute, which is resolved asynchronously on load
 * and updated on every `asc:collection:change` event.
 *
 * Label strings support a `{name}` token replaced with the target collection name.
 *
 * Usage:
 *   import collectionToggle from '.../collection-toggle/collection-toggle.js';
 *   container.insertAdjacentHTML('beforeend', collectionToggle(asset));
 *   container.insertAdjacentHTML('beforeend', collectionToggle(asset, { favorite: true }));
 *
 * @param {Asset}  asset
 * @param {object} [options]
 * @param {string} [options.addLabel='Add to {name}']       Label for the add button
 * @param {string} [options.removeLabel='Remove from {name}'] Label for the remove button
 * @param {string} [options.collectionId]                   Target a specific collection; omit for active
 * @param {boolean} [options.favorite=false]  Renders a star icon instead of +/− and always
 *   targets the default (Favorites) collection — `collectionId` is ignored when set. Pair with
 *   a plain (non-favorite, no explicit collectionId) toggle elsewhere on the page: the plain one
 *   auto-hides whenever the active collection IS the Favorites collection, since at that point
 *   both toggles would do the identical thing.
 * @returns {string} HTML string
 */
export default function collectionToggle(asset, options = {}) {
  const {
    addLabel = 'Add to {name}',
    removeLabel = 'Remove from {name}',
    collectionId = '',
    favorite = false,
  } = options;

  const targetId = favorite ? services.collections.getDefaultId() : collectionId;
  const collectionAttr = targetId ? ` data-asc-collection="${escAttr(targetId)}"` : '';
  const modifierClass = favorite ? ' asc-collection-toggle--favorite' : (!collectionId ? ' asc-collection-toggle--generic' : '');
  const addIcon = favorite ? ICONS.star : ICONS.add;
  const removeIcon = favorite ? ICONS.starFilled : ICONS.remove;
  const addDefaultLabel = favorite ? 'Add to {name}' : addLabel;
  const removeDefaultLabel = favorite ? 'Remove from {name}' : removeLabel;

  return `<div class="asc-collection-toggle${modifierClass}"
              data-asc-asset="${escAttr(asset.uuid)}"
              data-in-collection=""${collectionAttr}>
    <button class="asc-collection-toggle__btn asc-collection-toggle__add"
            data-asc-action="collection:add@click"
            data-asc-stop="true"
            data-asc-asset="${escAttr(asset.uuid)}"${collectionAttr}
            aria-pressed="false"
            type="button">
      <span class="asc-collection-toggle__icon" aria-hidden="true">${addIcon}</span>
      <span class="asc-collection-toggle__label" data-label="${escAttr(addDefaultLabel)}"
            >Add to collection</span>
    </button>
    <button class="asc-collection-toggle__btn asc-collection-toggle__remove"
            data-asc-action="collection:remove@click"
            data-asc-stop="true"
            data-asc-asset="${escAttr(asset.uuid)}"${collectionAttr}
            aria-pressed="false"
            type="button">
      <span class="asc-collection-toggle__icon" aria-hidden="true">${removeIcon}</span>
      <span class="asc-collection-toggle__label" data-label="${escAttr(removeDefaultLabel)}"
            >Remove from collection</span>
    </button>
  </div>`;
}

function escAttr(str) {
  return String(str ?? '').replace(/"/g, '&quot;');
}
