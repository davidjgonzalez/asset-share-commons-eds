// ASC Core — do not edit.

const PLACEHOLDER_SRC = '/styles/images/image-placeholder.svg';

/**
 * Registers a global capture-phase error handler that replaces any broken
 * <img> with the site placeholder SVG.  The data-img-error attribute guards
 * against an infinite loop if the placeholder itself ever fails to load.
 *
 * Call once from scripts.js during page initialisation.
 */
/**
 * Snaps `container.style.aspectRatio` to the image's natural dimensions once it
 * loads. Handles already-loaded (cached) images via the `img.complete` check.
 * @param {HTMLImageElement} img
 * @param {HTMLElement} container
 */
export function snapAspectRatio(img, container) {
  const snap = () => {
    if (img.naturalWidth && img.naturalHeight) {
      container.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
    }
  };
  if (img.complete) snap();
  else img.addEventListener('load', snap, { once: true });
}

export function setupImageFallback() {
  document.addEventListener('error', (e) => {
    const { target } = e;
    if (target.tagName !== 'IMG' || target.dataset.imgError) return;
    target.dataset.imgError = '1';
    target.removeAttribute('srcset');
    target.src = PLACEHOLDER_SRC;
  }, true);
}
