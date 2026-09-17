/** @owner user */
import { openNewCollectionDialog } from '../collections/collections.js';

/**
 * collections-actions — primary action(s) for the Collections index page,
 * authored as a sibling of the page title's "content" block and placed in
 * the same header row via the named-area section grid (docs/GRID_LAYOUT.md,
 * _area: collections-actions). See docs/starter-kit/collections.html.
 *
 * Zero-config: renders a single "New Collection" button that opens the same
 * creation dialog as the collections block's own management UI.
 */
export default function decorate(block) {
  block.innerHTML = '<button type="button" class="collections-actions__new-btn btn btn--primary">New Collection</button>';
  block.querySelector('.collections-actions__new-btn').addEventListener('click', () => {
    openNewCollectionDialog();
  });
}
