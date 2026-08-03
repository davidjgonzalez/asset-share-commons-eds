/** @owner user */

/**
 * content — passthrough block for default content (h2, h3, p, img, ul, ol, etc.).
 *
 * Exists solely so authored content can be assigned a named grid area via
 * section-metadata (area config row). All table-wrapper divs are stripped;
 * the raw authored markup is promoted directly into the block element.
 *
 * Authoring:
 *   | content |
 *   | <h2>Heading</h2><p>Body text…</p> |
 *
 * To place in a grid area, add section-metadata and an area row to this block:
 *   | content (area) |
 *   | notes          |
 */
export default function decorate(block) {
  // Move the actual child nodes rather than round-tripping through innerHTML strings —
  // serializing and reparsing would create brand-new elements, severing any {{ }} token
  // element already recorded by scripts/asc/tokens.js's page-wide registry (registerTokens()
  // re-resolves onto the original elements; a rebuilt element never gets re-scanned since it
  // no longer contains the raw {{ }} text once the first pass has emptied it).
  const cells = [...block.querySelectorAll(':scope > div > div')];
  block.replaceChildren(...cells.flatMap((cell) => [...cell.childNodes]));
}
