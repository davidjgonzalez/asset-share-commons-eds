// ASC Core — do not edit. Customize via scripts/asc/configurations.js
//
// Relocates an element into the sticky page header (header .nav-wrapper) so
// it scrolls with the header instead of scrolling away with wherever it was
// originally rendered. The header is lazy-loaded (loadHeader() in
// scripts/scripts.js), so this retries via MutationObserver until it's ready.

/**
 * @param {Element} el - Element to move into header .nav-wrapper.
 * @param {() => void} [onMounted] - Called once the move actually happens
 *   (immediately, or later once the header has finished loading).
 */
export function mountToHeader(el, onMounted) {
  function attempt() {
    const navWrapper = document.querySelector('header .nav-wrapper');
    if (!navWrapper) return false;
    navWrapper.appendChild(el);
    if (onMounted) onMounted();
    return true;
  }

  if (attempt()) return;

  const observer = new MutationObserver(() => {
    if (attempt()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
