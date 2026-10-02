# core/parts/

Reusable UI pieces shared by several blocks. **ASC Core: do not edit.**

A part is a function or small class that returns HTML (and, where needed, ships its own CSS next to it).
It is not a block: no `decorate()`, never loaded on its own.

| Folder | Purpose |
|--------|---------|
| `asset-teaser/` | The asset card used by search results, collections and similar assets (renders UI Kit `.asc-ui-asset-card` markup) |
| `collection-toggle/` | Add/remove-from-collection and favorite buttons, hydrated page-wide |
| `rendition-download-menu/` | Floating "pick a rendition" menu for download / copy URL / copy image |
| `picture/` | Responsive `<picture>` markup helper |
| `part.js` | Contract notes for writing a part |

**Import from:** blocks (the intended consumers) and other parts.

**Rules**
- The constructor receives `{ block }`, the parent block element. Bind events with
  `delegateEvent(this.block, ...)`, never directly, so repeated renders do not stack listeners.
- Style through the UI Kit and CSS variables. A part's CSS may map legacy variables onto kit hooks, but
  must not restyle the kit.
- Customize a part by composing it in your own block, or through the CSS variables it documents. Do not
  edit it in place.
