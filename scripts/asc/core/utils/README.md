# core/utils/

Stateless helpers and small browser-behavior modules. **ASC Core: do not edit.**

**Import from:** anywhere (blocks, parts, services, models, `scripts/asc.js`). Utils must not import
parts or services.

| File | Purpose |
|------|---------|
| `events.js` | `delegateEvent()` for all event binding; `listenWhileConnected()` for document/window listeners that must die with their block |
| `html.js` | `escHtml`, `escAttr`, `propValue`, `pictureHtml`, formatting helpers. Use whenever building HTML strings |
| `icons.js` | `icon(name, opts)`: the only place inline SVG icons live |
| `dialogs.js` | Themed `confirmDialog()` / `promptDialog()` (replace `confirm`/`prompt`) |
| `tokens.js` | `{{ accessor \| fallback }}` content variable resolver (`registerTokens`, `resolveTokens*`) |
| `section-grid.js` | Named-area `_layout: grid` section grid, called by `ascDecorateMain` |
| `chrome.js` | `isChromeless()`: branded vs standalone page chrome |
| `asset-navigation.js` | Prev/Next asset list for the details modal, read from the page DOM |
| `speculation-rules.js` | Registers same-origin link prefetching |
| `blocks.js`, `fragments.js` | Block config reading and fragment loading helpers |
| `search.js`, `selection.js`, `keyboard.js`, `images.js` | Search param helpers, multi-select behavior, keyboard activation for `role=button`, broken-image fallback |
| `header-mount.js`, `view-transition.js`, `mosaic.js`, `clipboard-image.js` | Header relocation, View Transition wrapper, thumbnail mosaic math, copy-image support |
