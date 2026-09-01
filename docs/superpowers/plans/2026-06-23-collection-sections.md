# Collection Sections & Visual Refresh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the collections schema to a mixed `items[]` array (assets + sections), add inline section widgets to the collection detail block, update the share dialog to encode sections in the URL, and render section headings in the sheet block.

**Architecture:** Four isolated tasks in dependency order: (1) service migration, (2) block visual refresh + section widgets, (3) share dialog updates + share history, (4) sheet block section rendering. Each task is independently testable. No build step — vanilla JS ES modules served by `aem up`.

**Tech Stack:** Vanilla JS (ES modules), CSS nesting, localStorage via existing `storage` service, `services.url.compressArray` / `decompressToArray` for URL encoding.

## Global Constraints

- Never edit files under `scripts/asc/` without explicit instruction — they are "ASC Core". **Exception: this plan explicitly requires editing `scripts/asc/services/collections/collections.js`.**
- Root selector for any CSS file: `.block.<block-name> { … }` — CSS nesting inside.
- All spacing/color values use CSS variables (no hard-coded values).
- `npm run lint` must pass before every commit.
- No extra dependencies; no build step.
- Test via `aem up` (local dev proxy at `http://localhost:3000`).

---

## File Map

| File | Role |
|------|------|
| `scripts/asc/services/collections/collections.js` | Schema migration; new section CRUD; updated asset CRUD |
| `blocks/collections/collections.js` | Update `typeCountsHtml` for new `items[]` schema |
| `blocks/collection/collection.js` | Unified item list, section widgets, bigger rows, drag-drop, share dialog |
| `blocks/collection/collection.css` | Bigger thumb (120×90), section widget styles, share history styles |
| `blocks/sheet/sheet.js` | Parse `?items=`, render section headings, backward-compat `?assets=` |
| `blocks/sheet/sheet.css` | Section heading styles |

---

## Task 1: Collections Service Schema Migration

**Files:**
- Modify: `scripts/asc/services/collections/collections.js`

**Interfaces:**
- Produces:
  - All returned collection objects now include computed `assetIds: string[]` (backward compat)
  - All returned collection objects use `items: Array<{type:'asset',id,mimeType?} | {type:'section',id,title,body}>` as the source of truth
  - `_hydrateAssets(collection)` populates both `collection.hydratedItems` and `collection.assets`
  - New public methods: `addSection(collectionId, {title,body})`, `updateSection(collectionId, sectionId, {title,body})`, `removeSection(collectionId, sectionId)`, `reorder(collectionId, newItems)`
  - `reorderAssets` kept as alias for backward compat

---

- [ ] **Step 1.1: Update schema comment + `init()` — new collection shape**

  In `init()`, everywhere a new collection is created with `assetIds: [], assetTypes: {}`, replace with `items: []`:

  ```js
  // In the isMissing/isOldFormat branch (around line 64):
  this._setData({
    defaultId,
    items: {
      [defaultId]: {
        id: defaultId,
        name: 'My Collection',
        createdAt: now,
        modifiedAt: now,
        items: seedAssetIds.map((id) => ({ type: 'asset', id })),
      },
    },
  });

  // In the "Valid new schema" branch (around line 85-93):
  data.items[defaultId] = {
    id: defaultId,
    name: 'My Collection',
    createdAt: now,
    modifiedAt: now,
    items: [],
  };
  ```

  Also update the schema JSDoc comment at the top of the class:
  ```js
  /**
   * Collections storage schema (stored under storage key 'collections'):
   *
   * {
   *   defaultId: "uuid",
   *   items: {
   *     "uuid": {
   *       id:         string,
   *       name:       string,
   *       createdAt:  ISO string,
   *       modifiedAt: ISO string,
   *       items:      Array<AssetItem | SectionItem>
   *     }
   *   }
   * }
   *
   * AssetItem:   { type: 'asset', id: string, mimeType?: string }
   * SectionItem: { type: 'section', id: string, title: string, body: string }
   *
   * Active collection ID: storage.get(storage.ACTIVE_COLLECTION_ID) → UUID | null
   */
  ```

- [ ] **Step 1.2: Add v1→v2 migration in `init()`**

  After the existing v0→v1 / missing-schema block (after the `else` block closes, around line 95), add:

  ```js
  // v1→v2: migrate assetIds[]+assetTypes{} → items[]
  const d = this._getData();
  let needsMigration = false;
  Object.values(d.items || {}).forEach((c) => {
    if (!Array.isArray(c.assetIds)) return;
    needsMigration = true;
    const types = c.assetTypes || {};
    c.items = c.assetIds.map((id) => ({
      type: 'asset',
      id,
      ...(types[id] ? { mimeType: types[id] } : {}),
    }));
    delete c.assetIds;
    delete c.assetTypes;
  });
  if (needsMigration) this._setData(d);
  ```

  This runs on every `init()` call but is idempotent — once migrated, no collection has `assetIds` and it does nothing.

- [ ] **Step 1.3: Add `_decorate` private method**

  Add after `_hydrateAssets`:

  ```js
  /**
   * Adds computed backward-compat `assetIds` to a raw collection object.
   * Call on every collection before returning it from a getter.
   * @param {Object} collection - Raw collection from storage
   * @returns {Object} Decorated collection with assetIds computed
   */
  _decorate(collection) {
    return {
      ...collection,
      assetIds: (collection.items || [])
        .filter((i) => i.type === 'asset')
        .map((i) => i.id),
    };
  }
  ```

- [ ] **Step 1.4: Update `_hydrateAssets`**

  Replace the current implementation:

  ```js
  async _hydrateAssets(collection) {
    const assetItemIds = (collection.items || [])
      .filter((i) => i.type === 'asset')
      .map((i) => i.id);

    const hydratedAssets = await Promise.all(assetItemIds.map((id) => Asset.create(id)));
    const assetMap = new Map(hydratedAssets.map((a) => [a?.uuid, a]));

    collection.hydratedItems = (collection.items || []).map((item) => {
      if (item.type !== 'asset') return item;
      return { ...item, asset: assetMap.get(item.id) || null };
    });

    // Backward compat — callers like the download dialog use collection.assets
    collection.assets = hydratedAssets.filter(Boolean);
    return collection;
  }
  ```

- [ ] **Step 1.5: Update getters to use `_decorate`**

  In `getAll`, `get`, `getDefault`, `getActive` — wrap returned collection objects with `_decorate`:

  ```js
  // getAll
  async getAll(hydrateAssets = false) {
    const { items } = this._getData();
    const collections = Object.values(items).map((c) => this._decorate({ ...c }));
    if (!hydrateAssets) return collections;
    return Promise.all(collections.map((c) => this._hydrateAssets(c)));
  }

  // get
  async get(id, hydrateAssets = false) {
    const { items } = this._getData();
    const collection = items[id] ? this._decorate({ ...items[id] }) : null;
    if (!collection) return null;
    return hydrateAssets ? this._hydrateAssets(collection) : collection;
  }
  ```

  `getDefault` and `getActive` delegate to `get`, so they're covered automatically.

- [ ] **Step 1.6: Update `create()` to use `items: []`**

  ```js
  create(name) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const collection = {
      id,
      name,
      createdAt: now,
      modifiedAt: now,
      items: [],
    };
    // ... rest unchanged
  }
  ```

- [ ] **Step 1.7: Update `addAsset` — operate on raw storage**

  Replace the method to use `_getData()` directly (avoids dealing with decorated objects):

  ```js
  async addAsset(assetId, collectionId) {
    const id = collectionId || this.getActiveId();
    const data = this._getData();
    const collection = data.items[id];
    if (!collection) { console.error(`Collection "${id}" not found`); return; }

    if ((collection.items || []).some((i) => i.type === 'asset' && i.id === assetId)) return;

    const item = { type: 'asset', id: assetId };
    const cachedAsset = window.asc?.cache?.assets?.get(assetId);
    if (cachedAsset?.mimeType) item.mimeType = cachedAsset.mimeType;

    collection.items = [...(collection.items || []), item];
    this._saveCollection(collection);

    document.dispatchEvent(new CustomEvent(Events.ASSET_ADDED, { detail: { collectionId: id, assetId } }));
    document.dispatchEvent(new CustomEvent(Events.CHANGED, { detail: { action: 'assetAdded', collectionId: id, assetId } }));
  }
  ```

- [ ] **Step 1.8: Update `removeAsset` — operate on raw storage**

  ```js
  async removeAsset(assetId, collectionId) {
    const id = collectionId || this.getActiveId();
    const data = this._getData();
    const collection = data.items[id];
    if (!collection) { console.error(`Collection "${id}" not found`); return; }
    if (!(collection.items || []).some((i) => i.type === 'asset' && i.id === assetId)) return;

    collection.items = (collection.items || []).filter((i) => !(i.type === 'asset' && i.id === assetId));
    this._saveCollection(collection);

    document.dispatchEvent(new CustomEvent(Events.ASSET_REMOVED, { detail: { collectionId: id, assetId } }));
    document.dispatchEvent(new CustomEvent(Events.CHANGED, { detail: { action: 'assetRemoved', collectionId: id, assetId } }));
  }
  ```

- [ ] **Step 1.9: Update `hasAsset`**

  ```js
  async hasAsset(assetId, collectionId) {
    const id = collectionId || this.getActiveId();
    const data = this._getData();
    const collection = data.items[id];
    return (collection?.items || []).some((i) => i.type === 'asset' && i.id === assetId);
  }
  ```

- [ ] **Step 1.10: Replace `reorderAssets` with `reorder`**

  Replace the current `reorderAssets` method:

  ```js
  /**
   * Replaces the full item order in a collection.
   * Accepts the full mixed items array from the DOM (asset + section items).
   * For section items, current title/body from the DOM are captured and saved.
   * Unknown IDs are silently dropped.
   * @param {string} collectionId
   * @param {Array<{type,id,title?,body?}>} newItems
   */
  reorder(collectionId, newItems) {
    const data = this._getData();
    const collection = data.items[collectionId];
    if (!collection) { console.error(`Collection "${collectionId}" not found`); return; }

    const existingMap = new Map((collection.items || []).map((i) => [i.id, i]));
    collection.items = newItems
      .filter((item) => existingMap.has(item.id))
      .map((item) => {
        if (item.type !== 'section') return existingMap.get(item.id);
        // Merge in DOM values (captures any unsaved inline edits from drag)
        const existing = existingMap.get(item.id);
        return { ...existing, title: item.title ?? existing.title, body: item.body ?? existing.body };
      });

    this._saveCollection(collection);
    document.dispatchEvent(new CustomEvent(Events.CHANGED, { detail: { action: 'reordered', id: collectionId } }));
  }

  // Backward-compat alias
  reorderAssets(collectionId, newAssetIds) {
    this.reorder(collectionId, newAssetIds.map((id) => ({ type: 'asset', id })));
  }
  ```

- [ ] **Step 1.11: Add `addSection`, `updateSection`, `removeSection`**

  ```js
  /**
   * Appends a new section widget to the end of a collection's items.
   * @param {string} collectionId
   * @param {{title?: string, body?: string}} [opts]
   * @returns {Object} The new SectionItem
   */
  async addSection(collectionId, { title = '', body = '' } = {}) {
    const id = collectionId || this.getActiveId();
    const data = this._getData();
    const collection = data.items[id];
    if (!collection) { console.error(`Collection "${id}" not found`); return null; }

    const section = { type: 'section', id: crypto.randomUUID(), title, body };
    collection.items = [...(collection.items || []), section];
    this._saveCollection(collection);

    document.dispatchEvent(new CustomEvent(Events.CHANGED, { detail: { action: 'sectionAdded', collectionId: id } }));
    return section;
  }

  /**
   * Updates a section's title and/or body in place.
   * Does NOT dispatch CHANGED — avoids re-rendering while the user is typing.
   * @param {string} collectionId
   * @param {string} sectionId
   * @param {{title?: string, body?: string}} updates
   */
  updateSection(collectionId, sectionId, { title, body }) {
    const data = this._getData();
    const collection = data.items[collectionId];
    if (!collection) return;
    const section = (collection.items || []).find((i) => i.type === 'section' && i.id === sectionId);
    if (!section) return;
    if (title !== undefined) section.title = title;
    if (body !== undefined) section.body = body;
    this._saveCollection(collection);
  }

  /**
   * Removes a section by ID. Dispatches CHANGED.
   * @param {string} collectionId
   * @param {string} sectionId
   */
  async removeSection(collectionId, sectionId) {
    const id = collectionId || this.getActiveId();
    const data = this._getData();
    const collection = data.items[id];
    if (!collection) return;
    collection.items = (collection.items || []).filter((i) => !(i.type === 'section' && i.id === sectionId));
    this._saveCollection(collection);
    document.dispatchEvent(new CustomEvent(Events.CHANGED, { detail: { action: 'sectionRemoved', collectionId: id } }));
  }
  ```

- [ ] **Step 1.12: Update `loginAs` for new schema**

  Replace the anonymous asset extraction and merge logic:

  ```js
  // Replace:
  const anonymousAssetIds = Object.values(anonymousData.items || {}).flatMap(c => c.assetIds || []);
  // With:
  const anonymousAssetIds = Object.values(anonymousData.items || {}).flatMap(
    (c) => (c.items || []).filter((i) => i.type === 'asset').map((i) => i.id),
  );

  // In the isMissingUserData/isOldUserFormat branch, change the new collection shape:
  data.items[defaultId] = {
    id: defaultId, name: 'My Collection', createdAt: now, modifiedAt: now, items: [],
  };

  // Replace the merge logic:
  // Old: const merged = [...new Set([...defaultCollection.assetIds, ...anonymousAssetIds])];
  //      defaultCollection.assetIds = merged;
  // New:
  if (anonymousAssetIds.length > 0) {
    const data = this._getData();
    const defaultCollection = data.items[data.defaultId];
    if (defaultCollection) {
      const existingIds = new Set(
        (defaultCollection.items || []).filter((i) => i.type === 'asset').map((i) => i.id),
      );
      const newItems = anonymousAssetIds
        .filter((id) => !existingIds.has(id))
        .map((id) => ({ type: 'asset', id }));
      defaultCollection.items = [...(defaultCollection.items || []), ...newItems];
      defaultCollection.modifiedAt = new Date().toISOString();
      this._setData(data);
    }
  }
  ```

- [ ] **Step 1.13: Lint and verify**

  ```bash
  npm run lint:js
  ```

  Expected: 0 errors. Fix any issues before continuing.

- [ ] **Step 1.14: Update `collections/collections.js` index block for new schema**

  In `blocks/collections/collections.js`, `typeCountsHtml` reads `collection.assetTypes` — update for `items[]`:

  ```js
  function typeCountsHtml(collection) {
    const assetItems = (collection.items || []).filter((i) => i.type === 'asset');
    if (!assetItems.length) return '';
    // Only show breakdown when every asset has a known mimeType
    if (assetItems.some((i) => !i.mimeType)) return '';

    const counts = { image: 0, video: 0, document: 0, other: 0 };
    assetItems.forEach(({ mimeType }) => {
      if (mimeType.startsWith('image/')) counts.image++;
      else if (mimeType.startsWith('video/')) counts.video++;
      else if (mimeType.startsWith('application/')) counts.document++;
      else counts.other++;
    });

    const parts = [
      counts.image && `${counts.image} ${counts.image === 1 ? 'image' : 'images'}`,
      counts.video && `${counts.video} ${counts.video === 1 ? 'video' : 'videos'}`,
      counts.document && `${counts.document} ${counts.document === 1 ? 'doc' : 'docs'}`,
      counts.other && `${counts.other} other`,
    ].filter(Boolean);

    return parts.length
      ? `<p class="collections__card-types">${escHtml(parts.join(' · '))}</p>`
      : '';
  }
  ```

  Note: `collection.assetIds` still works in `collectionCard` — it's now the computed property from `_decorate`. No other change needed in `blocks/collections/collections.js`.

- [ ] **Step 1.15: Lint again and commit**

  ```bash
  npm run lint
  git add scripts/asc/services/collections/collections.js blocks/collections/collections.js
  git commit -m "feat: migrate collections schema to items[] with section support"
  ```

---

## Task 2: Collection Block Visual Refresh + Section Widgets

**Files:**
- Modify: `blocks/collection/collection.js`
- Modify: `blocks/collection/collection.css`

**Interfaces:**
- Consumes from Task 1:
  - `collection.hydratedItems: Array<HydratedAssetItem | SectionItem>`
    where `HydratedAssetItem = {type:'asset', id, mimeType?, asset: Asset}`
  - `collection.assetIds: string[]` (computed, for count display)
  - `services.collections.addSection(collectionId, {title, body}): Promise<SectionItem>`
  - `services.collections.updateSection(collectionId, sectionId, {title?, body?}): void`
  - `services.collections.removeSection(collectionId, sectionId): Promise<void>`
  - `services.collections.reorder(collectionId, newItems): void`

---

- [ ] **Step 2.1: Update CSS — bigger thumbnails and asset row grid**

  In `blocks/collection/collection.css`, update the `__asset-row` grid and `__asset-thumb` size:

  ```css
  .collection__asset-row {
      /* Change: 18px 64px → 18px 120px */
      grid-template-columns: 18px 120px minmax(0, 1fr) auto;
      /* Keep everything else unchanged */
  }

  .collection__asset-thumb {
      /* Change from 64×48 to 120×90 */
      width: 120px;
      height: 90px;
      border-radius: var(--border-radius-sm);
      overflow: hidden;
      flex-shrink: 0;
      border: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);

      img {
          width: 100%;
          height: 100%;
          object-fit: cover;
      }
  }

  /* Mobile: scale down gracefully */
  @media (width <= 600px) {
      .collection__asset-row {
          grid-template-columns: 18px 80px minmax(0, 1fr) auto;
          gap: var(--spacing-sm);
          padding: var(--spacing-xs) var(--spacing-sm);
      }

      .collection__asset-thumb {
          width: 80px;
          height: 60px;
      }
  }
  ```

- [ ] **Step 2.2: Add section widget CSS**

  Add inside `.block.collection { … }` after the asset row styles:

  ```css
  /* ── Section widget ──────────────────────────────────────────────── */

  .collection__section-widget {
      display: grid;
      grid-template-columns: 18px 1fr auto;
      align-items: start;
      gap: var(--collection-gap);
      padding: var(--spacing-md);
      background: color-mix(in srgb, var(--color-primary) 4%, var(--color-card));
      border: 1px solid color-mix(in srgb, var(--color-primary) 20%, var(--color-border));
      border-left: 3px solid var(--color-primary);
      border-radius: var(--collection-radius);
      cursor: default;

      &.collection__section-widget--dragging {
          opacity: 0.45;
      }

      &.collection__section-widget--over {
          box-shadow: inset 0 3px 0 0 var(--color-primary);
      }
  }

  .collection__section-content {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xs);
  }

  .collection__section-title {
      margin: 0;
      padding: var(--spacing-2xs) var(--spacing-xs);
      font-size: var(--heading-font-size-s);
      font-weight: 600;
      color: var(--color-fg);
      border: 1px solid transparent;
      border-radius: var(--border-radius-sm);
      background: transparent;
      font-family: inherit;
      width: 100%;
      transition: border-color var(--transition-fast), background var(--transition-fast);

      &:focus-visible {
          outline: none;
          border-color: var(--color-ring);
          background: var(--color-input);
          box-shadow: var(--focus-ring);
      }

      &::placeholder {
          color: var(--color-muted-fg);
          font-weight: 400;
      }
  }

  .collection__section-body {
      margin: 0;
      padding: var(--spacing-2xs) var(--spacing-xs);
      font-size: var(--body-font-size-s);
      color: var(--color-fg);
      border: 1px solid transparent;
      border-radius: var(--border-radius-sm);
      background: transparent;
      font-family: inherit;
      resize: vertical;
      width: 100%;
      transition: border-color var(--transition-fast), background var(--transition-fast);

      &:focus-visible {
          outline: none;
          border-color: var(--color-ring);
          background: var(--color-input);
          box-shadow: var(--focus-ring);
      }

      &::placeholder {
          color: var(--color-muted-fg);
      }
  }

  .collection__section-delete {
      color: var(--color-muted-fg);
      flex-shrink: 0;
      align-self: start;

      &:hover {
          color: var(--color-destructive);
          background: color-mix(in srgb, var(--color-destructive) 10%, transparent);
      }
  }

  /* ── Add section button ──────────────────────────────────────────── */

  .collection__add-section {
      width: 100%;
      margin-block-start: var(--spacing-xs);
      color: var(--color-muted-fg);
      border: 1px dashed var(--color-border);
      background: transparent;

      &:hover {
          color: var(--color-primary);
          border-color: var(--color-primary);
          background: color-mix(in srgb, var(--color-primary) 4%, transparent);
      }
  }

  /* ── Share history ───────────────────────────────────────────────── */

  .collection__share-history {
      margin-block-start: var(--spacing-md);
      border: 1px solid var(--color-border);
      border-radius: var(--collection-radius);
      overflow: hidden;
  }

  .collection__share-history summary {
      padding: var(--spacing-sm) var(--spacing-md);
      font-size: var(--body-font-size-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-muted-fg);
      cursor: pointer;
      background: var(--color-muted);
      list-style: none;

      &::marker { display: none; }
      &::-webkit-details-marker { display: none; }

      &::before {
          content: '▶ ';
          font-size: 0.65em;
          vertical-align: middle;
      }
  }

  details[open] .collection__share-history summary::before {
      content: '▼ ';
  }

  .collection__share-history-list {
      list-style: none;
      margin: 0;
      padding: 0;
  }

  .collection__share-history-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      padding: var(--spacing-xs) var(--spacing-md);
      border-top: 1px solid var(--color-border);
      font-size: var(--body-font-size-s);
  }

  .collection__share-history-title {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--color-fg);
  }

  .collection__share-history-date {
      color: var(--color-muted-fg);
      font-size: var(--body-font-size-xs);
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
  }
  ```

- [ ] **Step 2.3: Update `html()` in `collection.js` to use `hydratedItems`**

  Change the asset list section in `html()`:

  ```js
  function html(collection, isDefault, pendingJobs) {
    const items = collection.hydratedItems || [];
    const assetCount = (collection.assetIds || []).length;
    const updated = formatUpdated(collection.modifiedAt);
    return `
      <section class="collection__shell" aria-label="Collection">
      <header class="collection__header">
        ...
        <p class="collection__meta">
          <span class="collection__meta-count">${assetCount} asset${assetCount !== 1 ? 's' : ''}</span>
          ...
        </p>
      </header>

      <div class="collection__toolbar">
        <button type="button" class="collection__share-btn btn btn--secondary">Share</button>
        <button type="button" class="collection__download-btn btn btn--primary"
                ${assetCount === 0 ? 'disabled' : ''}>Download</button>
      </div>

      ${pendingJobs.length ? renderJobsStatus(pendingJobs) : ''}

      <div class="collection__asset-list" data-collection-id="${collection.id}">
        ${items.length
      ? items.map((item) => (item.type === 'section' ? sectionWidget(item) : assetRow(item))).join('')
      : '<p class="collection__empty">No assets in this collection yet.</p>'}
        <button type="button" class="collection__add-section btn btn--ghost">+ Add section</button>
      </div>
      </section>`;
  }
  ```

- [ ] **Step 2.4: Update `assetRow` to accept a hydratedItem**

  The function signature changes: it now receives a `HydratedAssetItem` (`{type, id, mimeType?, asset: Asset}`) instead of a raw `Asset`:

  ```js
  function assetRow(item) {
    const { asset } = item;
    const thumbnailUrl = services.renditions.getThumbnailUrl(asset);
    return `
      <div class="collection__asset-row"
           draggable="true"
           data-asc-asset="${asset.uuid}"
           data-item-type="asset">
        <div class="collection__asset-drag" aria-hidden="true" title="Drag to reorder"></div>
        <div class="collection__asset-thumb">
          <img src="${thumbnailUrl}" alt="${escHtml(asset.title)}" loading="lazy" />
        </div>
        <div class="collection__asset-info">
          <div class="collection__asset-title">${escHtml(asset.title)}</div>
          <div class="collection__asset-meta">${escHtml(asset.getProperty('file-type') || '')}</div>
        </div>
        <button type="button" class="collection__asset-remove btn btn--ghost btn--sm"
                aria-label="Remove ${escHtml(asset.title)} from collection"
                data-asc-action="collection:remove@click"
                data-asc-asset="${asset.uuid}">Remove</button>
      </div>`;
  }
  ```

- [ ] **Step 2.5: Add `sectionWidget` function**

  Add after `assetRow`:

  ```js
  function sectionWidget(item) {
    return `
      <div class="collection__section-widget"
           draggable="true"
           data-section-id="${escAttr(item.id)}"
           data-item-type="section">
        <div class="collection__asset-drag" aria-hidden="true" title="Drag to reorder"></div>
        <div class="collection__section-content">
          <input type="text"
                 class="collection__section-title"
                 value="${escAttr(item.title)}"
                 placeholder="Section heading…"
                 aria-label="Section title" />
          <textarea class="collection__section-body"
                    placeholder="Optional description (Markdown supported)…"
                    rows="2"
                    aria-label="Section body">${escHtml(item.body)}</textarea>
        </div>
        <button type="button"
                class="collection__section-delete btn btn--ghost btn--sm"
                aria-label="Delete section"
                data-section-id="${escAttr(item.id)}">✕</button>
      </div>`;
  }
  ```

- [ ] **Step 2.6: Add section interaction wiring in `initInteractions`**

  Add `initSections` to the `initInteractions` call list:

  ```js
  function initInteractions(block, collection, isDefault) {
    initMenu(block);
    initRename(block, collection);
    initShare(block, collection);
    initDownload(block, collection);
    if (!isDefault) initDelete(block, collection);
    initReorder(block, collection);
    initSections(block, collection);
    initJobActions(block);
    if (_pendingSectionFocus) {
      const input = block.querySelector(`[data-section-id="${_pendingSectionFocus}"] .collection__section-title`);
      input?.focus();
      _pendingSectionFocus = null;
    }
  }
  ```

  Add module-level focus variable at the top of the file (after imports):

  ```js
  // Tracks section ID to focus after re-render triggered by addSection
  let _pendingSectionFocus = null;
  ```

  Add `initSections` function:

  ```js
  function initSections(block, collection) {
    // Add section button
    block.querySelector('.collection__add-section')?.addEventListener('click', async () => {
      const section = await services.collections.addSection(collection.id, { title: '', body: '' });
      if (section) _pendingSectionFocus = section.id;
      // CHANGED event from addSection triggers re-render which calls initInteractions,
      // which then picks up _pendingSectionFocus and focuses the new input.
    });

    // Section title blur → save
    block.addEventListener('blur', (e) => {
      const input = e.target.closest('.collection__section-title');
      if (!input) return;
      const widget = input.closest('[data-section-id]');
      if (!widget) return;
      services.collections.updateSection(
        collection.id,
        widget.dataset.sectionId,
        { title: input.value },
      );
    }, true); // useCapture to catch blur on inputs

    // Section body blur → save
    block.addEventListener('blur', (e) => {
      const textarea = e.target.closest('.collection__section-body');
      if (!textarea) return;
      const widget = textarea.closest('[data-section-id]');
      if (!widget) return;
      services.collections.updateSection(
        collection.id,
        widget.dataset.sectionId,
        { body: textarea.value },
      );
    }, true);

    // Section delete
    block.querySelectorAll('.collection__section-delete').forEach((btn) => {
      btn.addEventListener('click', () => {
        services.collections.removeSection(collection.id, btn.dataset.sectionId);
      });
    });
  }
  ```

  **Note on blur capture:** The two `addEventListener('blur', ..., true)` calls are both on `block`. Blur doesn't bubble, so `useCapture: true` is required to catch it via delegation. Each handler checks a different target class, so they're independent.

- [ ] **Step 2.7: Update `initReorder` for mixed item types**

  Replace `initReorder` with a version that handles both `.collection__asset-row` and `.collection__section-widget`:

  ```js
  const ROW_SEL = '.collection__asset-row, .collection__section-widget';

  function serializeRow(el) {
    if (el.dataset.ascAsset) return { type: 'asset', id: el.dataset.ascAsset };
    return {
      type: 'section',
      id: el.dataset.sectionId,
      title: el.querySelector('.collection__section-title')?.value || '',
      body: el.querySelector('.collection__section-body')?.value || '',
    };
  }

  function initReorder(block, collection) {
    const list = block.querySelector('.collection__asset-list');
    if (!list) return;

    let dragging = null;

    list.addEventListener('dragstart', (e) => {
      const row = e.target.closest(ROW_SEL);
      if (!row) return;
      dragging = row;
      row.classList.add(
        row.classList.contains('collection__asset-row')
          ? 'collection__asset-row--dragging'
          : 'collection__section-widget--dragging',
      );
      e.dataTransfer.effectAllowed = 'move';
    });

    list.addEventListener('dragend', () => {
      if (dragging) {
        dragging.classList.remove('collection__asset-row--dragging', 'collection__section-widget--dragging');
      }
      list.querySelectorAll('.collection__asset-row--over, .collection__section-widget--over').forEach((el) => {
        el.classList.remove('collection__asset-row--over', 'collection__section-widget--over');
      });
      dragging = null;
    });

    list.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const target = e.target.closest(ROW_SEL);
      if (!target || target === dragging) return;
      list.querySelectorAll('.collection__asset-row--over, .collection__section-widget--over').forEach((el) => {
        el.classList.remove('collection__asset-row--over', 'collection__section-widget--over');
      });
      target.classList.add(
        target.classList.contains('collection__asset-row')
          ? 'collection__asset-row--over'
          : 'collection__section-widget--over',
      );
    });

    list.addEventListener('drop', (e) => {
      e.preventDefault();
      const target = e.target.closest(ROW_SEL);
      if (!target || !dragging || target === dragging) return;

      const rows = [...list.querySelectorAll(ROW_SEL)];
      const fromIdx = rows.indexOf(dragging);
      const toIdx = rows.indexOf(target);
      if (fromIdx < toIdx) target.after(dragging);
      else target.before(dragging);

      const newItems = [...list.querySelectorAll(ROW_SEL)].map(serializeRow);
      services.collections.reorder(collection.id, newItems);
    });
  }
  ```

- [ ] **Step 2.8: Lint**

  ```bash
  npm run lint
  ```

  Expected: 0 errors.

- [ ] **Step 2.9: Manual browser test**

  ```bash
  aem up   # starts local proxy at http://localhost:3000
  ```

  Open the collection detail page. Verify:
  - Asset thumbnails are ~120px wide
  - "+ Add section" button appears at the bottom of the list
  - Clicking it adds a section widget with an empty title input (auto-focused)
  - Typing in the title and blurring saves (refresh page → title persists)
  - Body textarea saves on blur
  - ✕ button removes the section
  - Dragging assets and sections re-orders them; refresh → order persists
  - Dragging a section above an asset, and an asset above a section, both work

- [ ] **Step 2.10: Commit**

  ```bash
  git add blocks/collection/collection.js blocks/collection/collection.css
  git commit -m "feat: collection block visual refresh, bigger rows, section widgets"
  ```

---

## Task 3: Share Dialog — `?items=` Encoding + Share History

**Files:**
- Modify: `blocks/collection/collection.js` (share dialog only)

**Interfaces:**
- Consumes from Task 1:
  - `collection.items: Array<AssetItem | SectionItem>` — used to build the encoded URL
- Produces:
  - Share URL format: `?items=<compressed>&title=...`
  - Share history stored under `storage.get('shareHistory')` / `storage.set('shareHistory', [...])`

---

- [ ] **Step 3.1: Update `openShareDialog` to generate `?items=` URLs**

  Replace the `Generate Link` click handler in `openShareDialog`:

  ```js
  dialog.querySelector('.collection__share-generate').addEventListener('click', async () => {
    const title = dialog.querySelector('.collection__share-title').value.trim();

    // Build the mixed items array, encoding sections as ~title|||body
    const encodedItems = (collection.items || []).map((item) => {
      if (item.type === 'section') return `~${item.title}|||${item.body}`;
      return item.id;
    });
    const compressed = await services.url.compressArray(encodedItems);

    let url = `${window.location.origin}${SHEET_PATH}?items=${compressed}`;
    if (title) url += `&title=${encodeURIComponent(title)}`;

    // Save to share history
    saveShareHistory({ title: title || collection.name, url, collectionId: collection.id });

    const wrap = dialog.querySelector('.collection__share-url-wrap');
    wrap.removeAttribute('hidden');
    wrap.querySelector('.collection__share-url-output').value = url;
    dialog.querySelector('.collection__share-copy')?.removeAttribute('hidden');

    // Refresh history panel
    const historyEl = dialog.querySelector('.collection__share-history');
    if (historyEl) historyEl.outerHTML = renderShareHistory();
  });
  ```

- [ ] **Step 3.2: Remove the Description field from the share dialog**

  In the `openShareDialog` HTML, delete the description label and textarea:

  ```js
  // Remove this block from dialog.innerHTML:
  // <label class="collection__dialog-label">
  //   Description
  //   <textarea class="collection__share-description" placeholder="Optional description" rows="3"></textarea>
  // </label>
  ```

  The dialog body should have only:
  1. Sheet Title input
  2. Share URL wrap (hidden until generated)

- [ ] **Step 3.3: Add share history storage helpers**

  Add near the top of `collection.js` (after imports), before `decorate`:

  ```js
  const SHARE_HISTORY_KEY = 'shareHistory';
  const MAX_SHARE_HISTORY = 20;

  function saveShareHistory(entry) {
    const history = storage.get(SHARE_HISTORY_KEY) || [];
    history.unshift({ id: crypto.randomUUID(), ...entry, createdAt: new Date().toISOString() });
    storage.set(SHARE_HISTORY_KEY, history.slice(0, MAX_SHARE_HISTORY));
  }

  function renderShareHistory() {
    const history = storage.get(SHARE_HISTORY_KEY) || [];
    if (!history.length) return '';

    const items = history.map((entry) => {
      const date = new Date(entry.createdAt);
      const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return `
        <li class="collection__share-history-item">
          <span class="collection__share-history-title" title="${escAttr(entry.url)}">${escHtml(entry.title || 'Untitled')}</span>
          <span class="collection__share-history-date">${escHtml(label)}</span>
          <button type="button" class="btn btn--ghost btn--sm collection__share-history-copy"
                  data-url="${escAttr(entry.url)}">Copy</button>
        </li>`;
    }).join('');

    return `
      <details class="collection__share-history">
        <summary>Past shares (${history.length})</summary>
        <ul class="collection__share-history-list">${items}</ul>
      </details>`;
  }
  ```

  This requires importing `storage` in the block. Add to the block's imports:

  ```js
  import storage from '../../scripts/asc/services/storage/storage.js';
  ```

- [ ] **Step 3.4: Add share history panel to the dialog and wire Copy buttons**

  In `openShareDialog`, after the `dialog.innerHTML = ...` assignment, append the history panel to `.asc-dialog__body`:

  ```js
  const historyHtml = renderShareHistory();
  if (historyHtml) {
    dialog.querySelector('.asc-dialog__body').insertAdjacentHTML('beforeend', historyHtml);
  }
  ```

  Wire up history copy buttons (delegated, survives history refresh):

  ```js
  dialog.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('.collection__share-history-copy');
    if (!copyBtn) return;
    navigator.clipboard.writeText(copyBtn.dataset.url).then(() => {
      const orig = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = orig; }, 2000);
    });
  });
  ```

- [ ] **Step 3.5: Lint**

  ```bash
  npm run lint
  ```

- [ ] **Step 3.6: Manual browser test**

  - Open collection detail page with at least one section widget added
  - Click Share → dialog opens with no Description field
  - Click "Generate Link" → URL appears, contains `?items=`
  - Copy and open the URL in a new tab (requires Task 4 for full rendering)
  - Click Share again → "Past shares" `<details>` appears with the entry
  - Click Copy on a history entry → URL copies to clipboard

- [ ] **Step 3.7: Commit**

  ```bash
  git add blocks/collection/collection.js
  git commit -m "feat: share dialog encodes sections in ?items=, adds share history"
  ```

---

## Task 4: Sheet Block Section Rendering

**Files:**
- Modify: `blocks/sheet/sheet.js`
- Modify: `blocks/sheet/sheet.css`

**Interfaces:**
- Consumes: URL param `?items=<compressed>` where entries are either plain UUIDs (assets) or `~title|||body` (sections)
- Backward compat: `?assets=<compressed>` still works unchanged
- Produces: mixed list of asset rows and `<div class="sheet__section">` headings

---

- [ ] **Step 4.1: Update `getDataFromSearchParams` to handle `?items=`**

  Replace the function with a version that handles both formats:

  ```js
  async function getDataFromSearchParams(queryParameters) {
    const renditionsCompressed = queryParameters.get('renditions');
    const renditionIds = renditionsCompressed
      ? await services.url.decompressToArray(renditionsCompressed)
      : [];
    const renditionDefinitions = renditionIds
      .map((id) => services.renditions.getRenditionDefinition(id))
      .filter(Boolean);

    // New format: ?items= (mixed assets + sections)
    if (queryParameters.has('items')) {
      const entries = await services.url.decompressToArray(queryParameters.get('items'));
      const mixedItems = entries.map((entry) => {
        if (entry.startsWith('~')) {
          const sepIdx = entry.indexOf('|||', 1);
          const title = sepIdx === -1 ? entry.slice(1) : entry.slice(1, sepIdx);
          const body = sepIdx === -1 ? '' : entry.slice(sepIdx + 3);
          return { type: 'section', title, body };
        }
        return { type: 'asset', id: entry };
      });

      const assetIds = mixedItems.filter((i) => i.type === 'asset').map((i) => i.id);
      const fetchedAssets = await Promise.all(assetIds.map((id) => services.search.getAssetById(id)));
      const assetMap = new Map(fetchedAssets.filter(Boolean).map((a) => [a.uuid, a]));

      return { mixedItems, assetMap, renditionDefinitions };
    }

    // Legacy format: ?assets=
    const assetsCompressed = queryParameters.get('assets');
    const assetIds = assetsCompressed
      ? await services.url.decompressToArray(assetsCompressed)
      : [];
    const assets = await Promise.all(assetIds.map((id) => services.search.getAssetById(id)));

    // Normalise to mixedItems format for unified rendering
    const assetMap = new Map(assets.filter(Boolean).map((a) => [a.uuid, a]));
    const mixedItems = assetIds.map((id) => ({ type: 'asset', id }));

    return { mixedItems, assetMap, renditionDefinitions };
  }
  ```

- [ ] **Step 4.2: Add inline Markdown renderer**

  Add before `decorate`:

  ```js
  function renderMarkdown(md) {
    if (!md) return '';
    let html = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Links: [text](url)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>')
      // Bold
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>');

    // List items — collect runs of `- item` lines into <ul>
    html = html.replace(/((?:^- .+$\n?)+)/gm, (match) => {
      const items = match.trim().split('\n').map((line) => `<li>${line.slice(2)}</li>`).join('');
      return `<ul>${items}</ul>`;
    });

    // Paragraphs — split on blank lines, wrap non-block content
    html = html.split(/\n\n+/).map((chunk) => {
      const trimmed = chunk.trim();
      if (!trimmed || trimmed.startsWith('<ul>') || trimmed.startsWith('<li>')) return trimmed;
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');

    return html;
  }
  ```

- [ ] **Step 4.3: Add `sectionHeading` HTML function**

  ```js
  function sectionHeading(item) {
    return `
      <div class="sheet__section">
        <h2 class="sheet__section-title">${escHtml(item.title)}</h2>
        ${item.body ? `<div class="sheet__section-body">${renderMarkdown(item.body)}</div>` : ''}
      </div>`;
  }
  ```

  This requires `escHtml` from the shared helpers. Add import at top:

  ```js
  import { escHtml } from '../../scripts/html.js';
  ```

- [ ] **Step 4.4: Update `decorate` to use new data shape**

  ```js
  export default async function decorate(block) {
    const params = new URLSearchParams(window.location.search);
    const { mixedItems, assetMap, renditionDefinitions } = await getDataFromSearchParams(params);
    const title = params.get('title') ? decodeURIComponent(params.get('title')) : '';

    const assetCount = mixedItems.filter((i) => i.type === 'asset').length;
    block.innerHTML = html(mixedItems, assetMap, renditionDefinitions, title, assetCount);

    initRenditionSwitcher(block);
    initDragAndDrop(block);
  }
  ```

- [ ] **Step 4.5: Update `html()` for mixed items**

  ```js
  function html(mixedItems, assetMap, renditionDefinitions, title, assetCount) {
    const rows = mixedItems.map((item) => {
      if (item.type === 'section') return sectionHeading(item);
      const asset = assetMap.get(item.id);
      return asset ? assetRow(asset, renditionDefinitions) : '';
    }).join('');

    return `
      <a href="/" class="sheet__back">&#8592; Back to search</a>
      <h1 class="sheet__title">${title || 'Download Sheet'}</h1>
      <p class="sheet__count">${assetCount} asset${assetCount === 1 ? '' : 's'}</p>
      <div class="sheet__asset-list">
        ${rows || '<p class="sheet__empty">No assets selected.</p>'}
      </div>
    `;
  }
  ```

- [ ] **Step 4.6: Add section styles to `sheet.css`**

  Inside `.block.sheet { … }`:

  ```css
  .sheet__section {
      margin-block: var(--spacing-xl) var(--spacing-sm);
      padding-block-end: var(--spacing-sm);
      border-bottom: 1px solid var(--color-border);
  }

  .sheet__section-title {
      margin: 0 0 var(--spacing-xs);
      font-size: var(--heading-font-size-m);
      font-weight: 600;
      color: var(--color-fg);
  }

  .sheet__section-body {
      margin: 0;
      color: var(--color-muted-fg);
      font-size: var(--body-font-size-s);
      line-height: 1.6;

      p { margin: 0 0 var(--spacing-xs); }
      p:last-child { margin-bottom: 0; }

      ul {
          margin: var(--spacing-xs) 0;
          padding-inline-start: 1.4em;
      }

      li { margin-block: var(--spacing-2xs); }

      a { color: var(--color-primary); }
  }
  ```

- [ ] **Step 4.7: Lint**

  ```bash
  npm run lint
  ```

- [ ] **Step 4.8: Manual browser test**

  1. From the collection page, share a collection that has: 2 assets, a section ("Logos"), another asset, another section ("Campaigns"), 1 asset.
  2. Open the generated `?items=` URL.
  3. Verify:
     - Page shows "N assets" count (not including sections)
     - "Logos" h2 appears between the first 2 assets and the 3rd
     - "Campaigns" h2 appears before the last asset
     - Sections with a body show rendered Markdown (bold, italic, links work)
     - `?assets=` links from before this change still load correctly (backward compat)

- [ ] **Step 4.9: Commit**

  ```bash
  git add blocks/sheet/sheet.js blocks/sheet/sheet.css
  git commit -m "feat: sheet block renders section headings from ?items= URL format"
  ```

---

## Self-Review

**Spec coverage:**
- ✅ Schema migration (assetIds→items) — Task 1
- ✅ Backward-compat `assetIds` on returned objects — Task 1 (`_decorate`)
- ✅ Migration path in `init()` — Task 1, Step 1.2
- ✅ `addSection`, `updateSection`, `removeSection` — Task 1, Step 1.11
- ✅ Updated asset CRUD (`addAsset`, `removeAsset`, `hasAsset`) — Task 1, Steps 1.7–1.9
- ✅ `reorder` (mixed items) — Task 1, Step 1.10
- ✅ Bigger asset rows (120×90 thumbnails) — Task 2, Step 2.1
- ✅ Section widget HTML/CSS — Task 2, Steps 2.2, 2.5
- ✅ Section editing (title blur, body blur) — Task 2, Step 2.6
- ✅ Section delete — Task 2, Step 2.6
- ✅ "Add section" button with auto-focus — Task 2, Step 2.6
- ✅ Updated drag-and-drop for mixed items — Task 2, Step 2.7
- ✅ Share URL `?items=` encoding — Task 3, Step 3.1
- ✅ Remove description field from share dialog — Task 3, Step 3.2
- ✅ Share history storage + UI — Task 3, Steps 3.3–3.4
- ✅ Sheet block `?items=` parsing — Task 4, Step 4.1
- ✅ Sheet backward compat `?assets=` — Task 4, Step 4.1
- ✅ Section headings in sheet — Task 4, Steps 4.3–4.5
- ✅ Markdown rendering — Task 4, Step 4.2
- ✅ `loginAs` updated for new schema — Task 1, Step 1.12

**Placeholder scan:** None found.

**Type consistency:**
- `hydratedItems` used consistently in Task 1 (`_hydrateAssets`) and consumed in Task 2 (`html()`)
- `reorder(collectionId, newItems)` defined in Task 1, called in Task 2 (`initReorder`)
- `addSection` returns `SectionItem` in Task 1, `_pendingSectionFocus` set to `section.id` in Task 2
- `mixedItems` + `assetMap` returned from `getDataFromSearchParams` in Task 4, consumed in `decorate` and `html()`
- `SHARE_HISTORY_KEY = 'shareHistory'`, `MAX_SHARE_HISTORY = 20` constants defined in Task 3 Step 3.3
