/** @owner user */

/**
 * ASC integration entry point.
 *
 * Import this file from scripts/scripts.js and call the lifecycle hooks at the
 * appropriate EDS phase. ASC services are auto-initialized on module import.
 *
 * Configuration lives in scripts/asc/configurations.js — do not edit scripts/asc/core/.
 */
import { loadCSS } from './aem.js';
import './asc/core/services/services.js';
import configurations from './asc/configurations.js';
import { setupImageFallback } from './asc/core/utils/images.js';
import { setupRoleButtonKeyboardSupport } from './asc/core/utils/keyboard.js';
import { decorateASCSections } from './asc/section-grid.js';
import { registerTokens } from './asc/tokens.js';
import { initAnalytics } from './asc/analytics.js';
import { registerSpeculationRules } from './asc/speculation-rules.js';
import { isChromeless, renderChromeToggle } from './asc/chrome.js';
import './asc/notifications.js';

setupImageFallback();
setupRoleButtonKeyboardSupport();

// Re-export action-page utilities so blocks can import from a single stable path.
export { triggerAction, parseActionFragment, wireDialogClose } from './asc/core/services/action-pages/action-pages.js';

/** Called once in loadEager — applies theme and any other eager-phase ASC setup. */
export function ascEager(doc) {
  const theme = configurations.theme?.default;
  if (theme) {
    doc.body.classList.add(`theme-${theme}`);
    loadCSS(`${window.hlx.codeBasePath}/styles/themes/${theme}.css`);
  }
  // Set as early as possible (main exists in the raw HTML by now even though
  // decorateMain() hasn't run yet) so any [data-asc-nav-link] back-links
  // authored into the page's own content never flash visible before being
  // hidden — see scripts/asc/chrome.js.
  doc.body.classList.toggle('is-chromeless', isChromeless(doc.querySelector('main')));
}

/**
 * Called inside decorateMain, after decorateBlocks.
 * Registers URL params into the page-wide token registry (see tokens.js) — this
 * resolves any {{...}} token whose accessor matches a search param, anywhere in
 * the document. Then wires up the named-area grid layout.
 */
export function ascDecorateMain(main) {
  registerTokens(Object.fromEntries(new URLSearchParams(window.location.search)));
  decorateASCSections(main);
}

/** Called once in loadLazy — prefetch same-origin links for faster navigation. */
export function ascLazy() {
  registerSpeculationRules();
  renderChromeToggle();
}

/** Called once in loadDelayed — non-critical ASC work. */
export function ascDelayed() {
  initAnalytics();
}
