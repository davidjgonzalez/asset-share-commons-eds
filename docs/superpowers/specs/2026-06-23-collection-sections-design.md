# Collection Sections & Visual Refresh — Design Spec

**Date:** 2026-06-23  
**Status:** Approved

---

## Overview

Two connected improvements to the collection workflow:

1. **Visual refresh** — bigger asset rows in the collection detail block (larger thumbnails, more breathing room)
2. **Inline sections** — editable heading + body widgets that can be reordered alongside assets; sections travel to the shared sheet view
3. **Share history** — generated share URLs saved to localStorage so they can be retrieved later

---

## Schema Migration

### Current

```js
{
  id, name, createdAt, modifiedAt,
  assetIds: string[],
  assetTypes: { [uuid]: mimeType }
}
```

### New

```js
{
  id, name, createdAt, modifiedAt,
  items: Array<AssetItem | SectionItem>
}

AssetItem:   { type: 'asset',   id: string,            mimeType?: string }
SectionItem: { type: 'section', id: string /* uuid */, title: string, body: string }
```

`assetTypes` is folded into `AssetItem.mimeType`. The service computes a backward-compatible `assetIds` array (asset IDs in order) on every collection object it returns, so existing block code that reads `collection.assetIds` continues to work without changes.

### Migration path

On `init()`, existing collections with `assetIds[]` are migrated: each ID becomes `{type:'asset', id}`, existing `assetTypes` entries populate `mimeType`. Migration is idempotent.

---

## Collections Service Changes (`scripts/asc/services/collections/collections.js`)

### Modified methods

| Method | Change |
|--------|--------|
| `addAsset(assetId, collectionId)` | Pushes `{type:'asset', id, mimeType?}` to `items`; reads mimeType from global cache as before |
| `removeAsset(assetId, collectionId)` | Filters `items` by `item.id !== assetId` (for type='asset' items) |
| `hasAsset(assetId, collectionId)` | Checks `items` for matching asset id |
| `reorderAssets(collectionId, newItems)` | Accepts the full mixed `items[]` array and replaces; validates no unknown IDs are introduced |
| `_hydrateAssets(collection)` | Hydrates only `type:'asset'` items; non-asset items pass through untouched |
| `getAll/get/getDefault/getActive` | Each returned collection object gains a computed `assetIds: string[]` (asset IDs in order) for backward compat |

### New methods

```js
addSection(collectionId, { title, body })
  // Appends a SectionItem with a new UUID to items[]; dispatches CHANGED

updateSection(collectionId, sectionId, { title, body })
  // Finds item by id, updates in place; dispatches CHANGED

removeSection(collectionId, sectionId)
  // Filters out matching section item; dispatches CHANGED
```

### New asset placement

`addAsset` always appends to the **end** of `items`. No auto-section assignment. The user drags assets into position after adding.

---

## Collection Block Visual Refresh (`blocks/collection/`)

### Bigger asset rows

Thumbnail grows from 64×48 to **120×90 px**. Row has more vertical padding. Title and meta have more room.

```
[ drag ] [ 120×90 thumb ] [ title + meta + file type ] [ Remove ]
```

### Unified item list

`html()` renders `collection.items` (not `collection.assets`) as a mixed list:

- `type: 'asset'` → existing asset row (taller)
- `type: 'section'` → section widget (see below)

### Section widget

Visually distinct from asset rows — lighter background, left accent border, no drag dots on the thumb column.

```
[ drag ] [ ✏ Section title (h2, editable)            ] [ 🗑 ]
          [ Body text (textarea, Markdown accepted)   ]
```

- **Title**: plain `<input>` styled as h2, saves on blur/Enter
- **Body**: `<textarea>` (auto-resize), saves on blur
- **Delete**: trash button, no confirm (assets in the collection are unaffected)
- **Drag handle**: same CSS dot grid as asset rows; drag works across the mixed list

### "Add section" button

A small `btn--ghost` at the bottom of the asset list: `+ Add section`. Calls `services.collections.addSection(...)` with empty title/body, then focuses the new title input.

### Drag-and-drop

The existing drag-and-drop reads `data-index` and persists via `reorderAssets`. This changes to read the full `items[]` order from the DOM and call the updated `reorderAssets(collectionId, newItems)`.

Both asset rows and section widgets are draggable. `dragover` accepts drops from either type.

---

## Share URL Encoding

### Current format
```
?assets=<compressed-uuids>&title=...&description=...
```

### New format (when sections exist)
```
?items=<compressed-items>&title=...
```

Where `<compressed-items>` is the result of compressing a JSON-serialised mixed array:
- Asset entry: `uuid` (plain string, 36 chars)
- Section entry: `"~<title>|||<body>"` (tilde prefix, `|||` separator — unlikely to appear in authored text)

This keeps asset entries as bare UUIDs (same as before) and sections as prefixed strings. The existing `url.compressArray` / `url.decompressToArray` pair handles both. The sheet block distinguishes entries by the `~` prefix.

The old `?assets=...` format continues to work in the sheet block (backward compat).

### Share dialog changes

- Title field pre-filled from `collection.name`
- "Generate Link" compresses `items` with sections interleaved, builds URL
- Generated URL saved to share history (see below)

---

## Sheet Block Section Rendering (`blocks/sheet/`)

When the URL has `?items=...`:
1. Decompress → mixed array
2. Walk in order: bare UUID → load asset row; `~`-prefixed string → render section heading

### Section heading HTML

```html
<div class="sheet__section">
  <h2 class="sheet__section-title">Logos</h2>
  <p class="sheet__section-body"><!-- rendered Markdown --></p>
</div>
```

### Markdown rendering (inline, no library)

Tiny sequential regex transform supporting:

| Syntax | Output |
|--------|--------|
| `**text**` | `<strong>text</strong>` |
| `*text*` | `<em>text</em>` |
| `[text](url)` | `<a href="url">text</a>` |
| `- item\n` | `<ul><li>item</li></ul>` |
| blank line | paragraph break |

Only applied in the sheet (read view), never in the collection editor.

---

## Share History

### Storage

Saved under localStorage key `asc:shareHistory` (scoped via existing storage service, user-aware):

```js
[
  { id: uuid, title: string, url: string, collectionId: string, createdAt: ISO }
]
```

Max 20 entries; oldest trimmed on overflow. Newest first.

### UI in the Share dialog

Below the Generate/Copy section, a collapsible `<details>` element:

```
▶ Past shares (3)
  Q1 Brand Kit     Jun 20  [Copy]
  Partner Logos    Jun 15  [Copy]
```

Each row: title, relative date, Copy button. No delete (max 20 auto-trims).

---

## Files Modified

| File | Change |
|------|--------|
| `scripts/asc/services/collections/collections.js` | Schema migration, addSection, updateSection, removeSection, updated CRUD |
| `blocks/collection/collection.js` | Mixed item list, section widgets, bigger rows, updated drag-drop |
| `blocks/collection/collection.css` | Bigger thumb, section widget styles |
| `blocks/sheet/sheet.js` | Parse `?items=`, render sections, backward-compat `?assets=` |
| `blocks/sheet/sheet.css` | Section heading styles |

The URL service and storage service require no changes — the `~`-prefix encoding uses existing `compressArray`/`decompressToArray`.

---

## Out of Scope

- Rich Markdown editor (WYSIWYG)
- Server-side sheet persistence
- Multiple sheets per collection
- Section asset assignment on add (new assets always go to bottom)
