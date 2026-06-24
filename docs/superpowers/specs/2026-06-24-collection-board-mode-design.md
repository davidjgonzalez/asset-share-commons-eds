# Collection Board Mode — Design Spec

**Date:** 2026-06-24  
**Status:** Approved

---

## Intent & Purpose

The Board mode serves three connected goals:

1. **Creative workspace** — a spatial, tactile alternative to the ordered list. Users arrange assets the way they'd lay out prints on a desk: by feel, by relationship, by visual weight. Proximity implies grouping without requiring explicit containers.

2. **Personal organization aid** — per-asset notes let users capture *why* an asset is in the collection and *how* it should be used, while it's still fresh. The board becomes a thinking space for developing the collection's narrative.

3. **Communication tool** — when a collection is shared as a sheet, the notes and section headings travel with it. The person who built the collection can communicate intent, usage guidance, and context directly to the people receiving the sheet — not just a list of files, but a curated, annotated set of assets with meaning.

The Board is preparation infrastructure: organize and annotate here, share as a sheet from there.

---

## Mode Toggle

A two-button segmented control appears in the collection header toolbar, to the left of the Share/Download buttons:

```
[≡ List]  [⊞ Board]
```

- Clicking switches modes instantly — no page reload, re-renders the block's content area
- Active mode persisted per-collection in localStorage under `asc:collectionMode:{collectionId}`
- Default mode: `list`
- The existing list render path is unchanged; board renders into a different DOM structure

---

## Schema Changes

`AssetItem` gains three optional fields:

```js
{
  type: 'asset',
  id: string,
  mimeType?: string,
  x?: number,        // canvas-space X coordinate (board mode)
  y?: number,        // canvas-space Y coordinate (board mode)
  notes?: string     // per-collection membership note
}
```

`x` and `y` are canvas-space coordinates (already divided by zoom — not screen pixels). Absent `x`/`y` means "not yet placed"; the board auto-places such cards in a loose cascade.

Notes are scoped to this collection membership — a curatorial annotation, not a global asset property.

No migration needed: all three fields are optional and absent means "not set."

---

## New Service Method

```js
collections.updateItem(collectionId, itemId, { x, y, notes })
```

- Partial-update: merges only the supplied keys onto the matching item in storage
- Does **not** dispatch `CHANGED` — callers update the DOM in real time and only persist on `pointerup` / `blur`
- Handles both position updates (from board drag) and notes updates (from inline edit)

The existing `reorder()` method for list drag-drop is unchanged. Board mode never calls it — array order is irrelevant on the canvas.

---

## Board Canvas Architecture

```
.board__viewport            — fills block content area; overflow: hidden; receives pan/zoom events
  └── .board__canvas        — transform: translate(panX px, panY px) scale(zoom); position: relative
        ├── .board__card    — position: absolute; left: Xpx; top: Ypx
        ├── .board__card
        └── ...
```

### Pan

`pointerdown` on the viewport background (not on a card) sets a panning flag.  
`pointermove` updates `panX`/`panY` by the pointer delta.  
`pointerup` clears the flag and saves viewport state.  
Cursor: `grab` when idle, `grabbing` while panning.  
`touch-action: none` on the viewport — pointer events handle touch natively.

### Zoom

`wheel` event on the viewport. Zoom centered on cursor position:

```js
newZoom = clamp(zoom * factor, MIN_ZOOM, MAX_ZOOM)
panX    = cursorX - (cursorX - panX) * (newZoom / zoom)
panY    = cursorY - (cursorY - panY) * (newZoom / zoom)
zoom    = newZoom
```

Range: **0.2×–3.0×**. Two-finger pinch on a trackpad works via the wheel event automatically.

### Viewport State Persistence

`{ panX, panY, zoom }` saved to localStorage under `asc:boardViewport:{collectionId}`.  
Restored when the user returns to board mode.  
A **"Reset view"** button (bottom-right corner, small ghost btn) snaps panX/panY to 0 and zoom to 1.

---

## Asset Cards

```
┌─────────────────┐
│                 │
│   160 × 120px   │  ← thumbnail (object-fit: cover)
│                 │
├─────────────────┤
│ Asset title     │  ← 1 line, ellipsis, ~12px
│ 📝 note text…   │  ← italic, muted, 11px — hidden when empty
└─────────────────┘
                  ✕  ← top-right, appears on hover (removes from collection)
```

Fixed width: **160px**. Subtle box-shadow and border-radius matching the UI kit card style.

### Card Drag

- `pointerdown` on the card body starts card-drag (captures pointer)
- `pointermove` updates `left`/`top` inline style in real time
- `pointerup` computes canvas-space coordinates, calls `updateItem({ x, y })`, releases capture

Canvas-space from screen position:
```js
canvasX = (screenX - viewportLeft - panX) / zoom
canvasY = (screenY - viewportTop - panY) / zoom
```

### Click vs Drag

If total pointer movement from `pointerdown` to `pointerup` is **< 5px**, treat as click → open asset details modal via existing `data-asc-action="asset:details:open@click"`.

### Remove

`✕` button appears on card hover (top-right, `position: absolute`). Calls `services.collections.removeAsset(assetId)`. No confirm dialog.

### Auto-placement

Cards without saved `x`/`y`:

```js
x = 80 + (index % 10) * 180
y = 80 + Math.floor(index / 10) * 160
```

---

## Notes

**Schema:** `notes?: string` on `AssetItem`.

### On the board

- Cards with notes show a small 📝 indicator and a truncated preview of the note below the title
- Clicking the note area opens a **floating sticky panel** positioned adjacent to the card on the canvas — full note text, editable inline
- Cards without notes show a faint `+ add note` hint on hover
- Clicking the hint opens the same floating panel with an empty editable field
- Panel dismisses on click-outside or Escape; saves on dismiss via `updateItem({ notes })`

### In list mode

- Notes appear as a small italic second line below the asset title in the info column
- Click to edit inline, saves on blur
- Hidden when empty; `+ add note` hint on row hover

### On the shared sheet

- Notes render as a small italic line below the asset row, only when present
- Encoded in the share URL (see below)

---

## Share URL — Single Compressed Payload

All sheet metadata is encoded into one compressed param `?sheet=<compressed>`, replacing the previous `?items=` and `?title=` params.

### Payload

```js
{
  title: string,          // sheet title (pre-filled from collection name)
  description?: string,   // optional collection-level context note
  items: string[]         // mixed encoded entries (see below)
}
```

Compressed using the existing URL service:
```js
const compressed = await services.url.compressArray([JSON.stringify(payload)]);
const url = `${origin}${SHEET_PATH}?sheet=${compressed}`;
```

Decompressed:
```js
const [json] = await services.url.decompressToArray(params.get('sheet'));
const { title, description, items } = JSON.parse(json);
```

### Items encoding

| Entry format | Meaning |
|---|---|
| `uuid` | Asset, no notes |
| `uuid\|\|\|notes text` | Asset with notes |
| `~title\|\|\|body` | Section heading |

The sheet parser checks `~` prefix first (section), then `|||` presence (asset with notes), otherwise plain asset UUID.

### Backward compat

The sheet block checks `?sheet=` first, then falls back to `?items=` (previous format), then `?assets=` (legacy format). Existing share links continue to work.

### Share dialog changes

Fields:
- **Title** — pre-filled from `collection.name`
- **Description** — optional, free-text, renders below `<h1>` on the sheet

The description field returns here as a collection-level context field, distinct from per-section bodies and per-asset notes.

---

## Sheet Block Changes

When `?sheet=` is present:
1. Decompress and parse JSON payload
2. Render `<h1>` title + optional `<p class="sheet__description">` below it
3. Walk `items[]`: UUID → asset row (with note if present); `~` → section heading

Asset row notes render as:
```html
<p class="sheet__asset-note">note text here</p>
```

Small, italic, muted — below the asset title/meta, above the rendition pills.

---

## Sections in Board Mode

Section widgets (list mode only) are **not shown** on the board. Switching to board mode hides them; switching back to list restores them. Section data in the schema is untouched.

---

## Files Modified

| File | Change |
|------|--------|
| `scripts/asc/services/collections/collections.js` | Add `updateItem()` method |
| `blocks/collection/collection.js` | Mode toggle, board render, card drag, pan/zoom, notes floating panel, updated share dialog |
| `blocks/collection/collection.css` | Board viewport, canvas, card, floating note panel, mode toggle styles |
| `blocks/sheet/sheet.js` | Parse `?sheet=`, render description, render per-asset notes, backward compat |
| `blocks/sheet/sheet.css` | Asset note styles |

---

## Out of Scope

- Explicit named group containers (freeform spatial proximity only)
- Lasso / multi-select
- Undo / redo
- Keyboard navigation on the canvas
