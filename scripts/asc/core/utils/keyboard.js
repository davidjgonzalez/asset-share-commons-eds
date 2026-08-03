// ASC Core — do not edit.

/**
 * Global keyboard-activation bridge for non-native interactive elements.
 *
 * A `role="button"`/`role="row"` element with `tabindex="0"` is focusable but
 * gets no Enter/Space activation for free the way a real <button> does — that
 * has to be wired up explicitly. This installs one document-level listener
 * that synthesizes a `click` on Enter/Space for any such element, so the
 * click handler it already has (a `data-asc-action="...@click"` binding, or a
 * plain delegated `click` listener like board.js's) fires for keyboard users
 * too, with no per-block keydown wiring needed.
 *
 * Call once from scripts/asc.js during page initialisation.
 */
export function setupRoleButtonKeyboardSupport() {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const target = e.target.closest('[role="button"][tabindex], [role="row"][tabindex], [role="gridcell"][tabindex]');
    if (!target) return;
    e.preventDefault();
    target.click();
  });
}
