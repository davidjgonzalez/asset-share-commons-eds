// ASC Core — do not edit. Customize via scripts/asc/configurations.js
/**
 * Runs `update` inside document.startViewTransition() where supported, falling back to
 * calling it directly. Browsers can skip a transition for reasons outside the caller's
 * control (reduced motion, an overlapping transition, a hidden document, closing a
 * top-layer element like <dialog>) — that just means no animation, so any resulting
 * rejection on `ready`/`finished` is swallowed rather than left as an unhandled rejection.
 * @param {() => void|Promise<void>} update
 */
export function withViewTransition(update) {
  if (!document.startViewTransition) {
    update();
    return;
  }
  const transition = document.startViewTransition(update);
  transition.ready.catch(() => {});
  transition.finished.catch(() => {});
}
