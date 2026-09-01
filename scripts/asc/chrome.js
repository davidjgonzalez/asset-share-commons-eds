/** @owner user */
/**
 * Chrome ("site navigation") duality for share/sheet/board pages — the same
 * published content can read as part of the overall Asset Share Commons site
 * (header, footer, search/collections links) or as a discrete, unbranded
 * microsite (none of that), depending on how it's reached.
 *
 * This is a presentational toggle only, not an access-control mechanism: it
 * hides navigational chrome, not AEM/DAM permissions. Someone can still edit
 * the URL by hand; nothing here restricts what they can technically reach.
 *
 * Resolution order:
 *   1. ?chrome=full  — force branded chrome ON, any page
 *   2. ?chrome=none  — force it OFF, any page
 *   3. <meta name="chrome" content="none"> — authored, for a fixed/authored
 *      share page (see docs/starter-kit/README.md)
 *   4. Otherwise: a `.sheet` block or `?sheet=` param (an ad hoc personal
 *      share) defaults to standalone — matches the behavior these links have
 *      always had (see the page-sheet class in scripts/scripts.js)
 *   5. Otherwise: branded (today's default for everything else)
 *
 * `main` is accepted as a param (rather than always querying the document)
 * so scripts/asc.js's ascEager(doc) can call this before `<main>` has been
 * decorated into blocks yet — the raw authored HTML already has the `.sheet`
 * class on its block wrapper regardless of decoration, so this is safe to
 * call as early as loadEager.
 */
import { getMetadata } from '../aem.js';

export function isChromeless(main = document.querySelector('main')) {
  const override = new URLSearchParams(window.location.search).get('chrome');
  if (override === 'full') return false;
  if (override === 'none') return true;
  if (getMetadata('chrome') === 'none') return true;
  const hasSheetParam = new URLSearchParams(window.location.search).has('sheet');
  return hasSheetParam || !!main?.querySelector('.sheet');
}

/** Share/sheet/board pages are the only ones the chrome toggle makes sense on. */
export function isSharePage(main = document.querySelector('main')) {
  return !!main?.querySelector('.sheet, .board')
    || new URLSearchParams(window.location.search).has('sheet')
    || getMetadata('chrome') === 'none';
}

function toggleUrl(makeChromeless) {
  const url = new URL(window.location.href);
  url.searchParams.set('chrome', makeChromeless ? 'none' : 'full');
  return url.toString();
}

/** Adds a small floating link to flip between branded and standalone views. */
export function renderChromeToggle() {
  if (!isSharePage()) return;
  const chromeless = isChromeless();
  const link = document.createElement('a');
  link.className = 'asc-chrome-toggle';
  link.href = toggleUrl(!chromeless);
  link.textContent = chromeless ? 'View with site navigation' : 'View as standalone page';
  document.body.append(link);
}
