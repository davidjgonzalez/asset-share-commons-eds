# Collection Board Mode — Design Spec

**Date:** 2026-06-24  
**Status:** Approved

---

## Overview

Add a **Board** display mode to the collection detail block alongside the existing **List** mode. The board is an infinite, pannable, zoomable canvas where asset cards can be freely dragged and positioned. Positions are persisted per-collection. Assets can carry per-collection **notes** visible in both modes.

---

## Mode Toggle

A two-button segmented control appears in the collection header toolbar, to the left of the Share/Download buttons:

```
[≡ List]  [⊞ Board]
```

- Clicking switches modes instantly — no page reload, re-renders the block's content area
- Active mode is persisted per-collection in localStorage under `asc:collectionMode:{collectionId}`
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

Notes are scoped to this collection membership — not a global asset property.

No migration needed: all three fields are optional and absent means "not set."

---

## New Service Method

```js
collections.updateItem(collectionId, itemId, { x, y, notes })
```

- Partial-update: merges only the supplied keys onto the matching item in storage
- Does **not** dispatch `CHANGED` — callers update the DOM in real time and only persist on `pointerup` / `blur`
- Handles both position updates (from board drag) and notes updates (from inline edit) via a single method

The existing `reorder()` method for list drag-drop is unchanged. Board mode never calls it — array order is irrelevant to the canvas.

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
`pointermove` updates `panX`/`panY` by the delta.  
`pointerup` clears the flag and saves viewport state to localStorage.  
Cursor: `grab` when idle, `grabbing` while panning.  
`touch-action: none` on the viewport — pointer events handle touch natively.

### Zoom

`wheel` event on the viewport.  
Zoom is centered on the cursor position: the canvas appears to expand/contract under the mouse, not from the top-left corner.

```
newZoom = clamp(zoom * factor, MIN_ZOOM, MAX_ZOOM)
panX    = cursorX - (cursorX - panX) * (newZoom / zoom)
panY    = cursorY - (cursorY - panY) * (newZoom / zoom)
zoom    = newZoom
```

Range: **0.2×–3.0×**. Standard two-finger pinch on a trackpad works via the wheel event automatically.

### Viewport State Persistence

`{ panX, panY, zoom }` saved to localStorage under `asc:boardViewport:{collectionId}`.  
Restored when the user returns to board mode.  
A **"Reset view"** button (bottom-right corner, small ghost btn) snaps `panX`/`panY` to 0 and `zoom` to 1.

---

## Asset Cards

```
┌─────────────────┐
│                 │
│   160 × 120px   │  ← thumbnail (object-fit: cover)
│                 │
├─────────────────┤
│ Asset title     │  ← 1 line, ellipsis overflow, ~12px
│ note text…      │  ← italic, muted, 11px (hidden when empty)
└─────────────────┘
                  ✕  ← appears on card hover (top-right, removes from collection)
```

Fixed width: **160px**. Height: auto (thumbnail + text). Subtle box-shadow and border-radius matching the UI kit card style.

### Card Drag (reposition on canvas)

- `pointerdown` on the card body starts a card-drag (captures the pointer)
- `pointermove` moves the card in real time by updating its `left`/`top` inline style
- `pointerup` computes canvas-space coordinates, calls `updateItem({ x, y })`, releases capture
- Canvas-space coordinate from screen position: `canvasX = (screenX - viewportLeft - panX) / zoom`

### Click vs Drag

If total pointer movement from `pointerdown` to `pointerup` is **< 5px**, treat as a click → open asset details modal via the existing `data-asc-action="asset:details:open@click"` mechanism.

### Remove

`✕` button appears on card hover (top-right corner, `position: absolute`). Calls `services.collections.removeAsset(assetId)`. No confirm dialog — consistent with the low-stakes feel of rearranging.

### Auto-placement

Cards without saved `x`/`y` are placed in a loose cascade:

```js
x = 80 + (index % 10) * 180
y = 80 + Math.floor(index / 10) * 160
```

This creates a loose grid that the user can then rearrange freely.

---

## Notes

**Schema:** `notes?: string` on `AssetItem` (optional, defaults to absent).

**Board card:** notes render as a small italic line below the title. When empty, a faint `+ add note` hint appears on card hover. Clicking the note area (or the hint) makes it editable inline (`contenteditable` or a positioned `<textarea>`). Saves on blur via `updateItem({ notes })`.

**List mode row:** notes appear as a second line below the asset title in the info column, styled muted and smaller. Same inline-edit-on-click pattern, saves on blur.

---

## Sections in Board Mode

Section widgets (from the list mode) are **not shown** on the board — they are a list-organization concept. Switching to board mode hides them; switching back to list mode shows them again. Section data in the schema is untouched.

---

## Files Modified

| File | Change |
|------|--------|
| `scripts/asc/services/collections/collections.js` | Add `updateItem()` method |
| `blocks/collection/collection.js` | Mode toggle, board render, card drag, pan/zoom, notes editing |
| `blocks/collection/collection.css` | Board viewport, canvas, card, notes styles |

No changes to the sheet block, collections index block, or URL service.

---

## Out of Scope

- Explicit named group containers (freeform spatial proximity only)
- Lasso/multi-select
- Board-mode sharing (share always uses list order)
- Undo/redo
- Keyboard navigation on the canvas
