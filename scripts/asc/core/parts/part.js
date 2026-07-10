// ASC Core — do not edit. Customize via scripts/asc/configurations.js

/**
 * Parts are plain exported functions that return HTML strings.
 * They are NOT blocks — they have no decorate() and are never loaded independently.
 * Blocks import Parts and insert their HTML.
 *
 * Pattern:
 *   export default function myPart(asset, options = {}) {
 *     return `<div class="asc-my-part">...</div>`;
 *   }
 *
 * Rules:
 * - Parts scope their CSS to a class like .asc-{part-name} (not .block.*).
 * - Each Part loads its own CSS via loadCSS() at module import time.
 * - Events are handled globally via data-asc-action attributes on the rendered HTML,
 *   processed by the Actions service — Parts do not bind events directly.
 */
