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
  block.innerHTML = [...block.querySelectorAll(':scope > div > div')]
    .map((cell) => cell.innerHTML)
    .join('');
}
