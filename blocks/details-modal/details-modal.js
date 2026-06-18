/** @owner user */
/**
 * details-modal — the native <dialog> shell for the asset details overlay.
 *
 * Authoring (da.live table):
 *
 *   | details-modal |         |
 *   | size          | wide    |   ← narrow | default | wide (default: wide)
 */

const SIZE_CLASSES = { narrow: 'asc-dialog--narrow', wide: 'asc-dialog--wide' };

export default async function decorate(block) {
  const size = parseSize(block);
  block.innerHTML = html(size);
  addEventListeners(block);
}

function parseSize(block) {
  for (const row of block.children) {
    const cells = [...row.children];
    if (cells[0]?.textContent.trim().toLowerCase() === 'size') {
      return cells[1]?.textContent.trim().toLowerCase() || 'wide';
    }
  }
  return 'wide';
}

function html(size) {
  const sizeClass = SIZE_CLASSES[size] ? ` ${SIZE_CLASSES[size]}` : '';
  return `<dialog class="asc-dialog${sizeClass}">
            <button class="btn btn--ghost btn--icon close" aria-label="Close" data-asc-action="asset:details:close@click">&#x2715;</button>
            <div class="content"></div>
          </dialog>`;
}

function addEventListeners(block) {
  document.body.addEventListener('asc:asset:details:close', () => {
    block.querySelector('dialog').close();
  });
}
