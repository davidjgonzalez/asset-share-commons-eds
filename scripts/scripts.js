import {
  buildBlock,
  loadHeader,
  loadFooter,
  decorateButtons,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
} from './aem.js';

// ASC-HOOK:start imports — re-add after an EDS boilerplate upgrade (see docs/PROJECT_STRUCTURE.md)
import {
  ascEager,
  ascDecorateMain,
  ascLazy,
  ascDelayed,
} from './asc.js';
import { isChromeless } from './asc/core/utils/chrome.js';
// ASC-HOOK:end imports

/**
 * Builds hero block and prepends to main in a new section.
 * @param {Element} main The container element
 */
function buildHeroBlock(main) {
  const h1 = main.querySelector('h1');
  const picture = main.querySelector('picture');
  if (h1 && picture && (h1.compareDocumentPosition(picture) & Node.DOCUMENT_POSITION_PRECEDING)) {
    const section = document.createElement('div');
    section.append(buildBlock('hero', { elems: [picture, h1] }));
    main.prepend(section);
  }
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch {
    // do nothing
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    buildHeroBlock(main);
  } catch (error) {
    console.error('Auto Blocking failed', error);
  }
}

// ASC-HOOK:start addPageTypeClasses — ASC-added helper; re-add after an EDS boilerplate upgrade
/**
 * Adds page-type body classes based on which blocks are present.
 * Called after decorateMain so block class names are available.
 * @param {Element} main The main element
 */
function addPageTypeClasses(main) {
  if (main.querySelector('.search-results')) document.body.classList.add('page-search');
  if (main.querySelector('.collections, .collection-switcher')) document.body.classList.add('page-collections');
  if (main.querySelector('.sheet') || new URLSearchParams(window.location.search).has('sheet')) {
    document.body.classList.add('page-sheet');
  }
  if (main.querySelector('.board')) document.body.classList.add('page-board');
}
// ASC-HOOK:end addPageTypeClasses

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
export function decorateMain(main) {
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
  ascDecorateMain(main); // ASC-HOOK decorateMain — run token substitution + section grid after decorateBlocks
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  ascEager(doc); // ASC-HOOK loadEager — theme + is-chromeless body class

  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    addPageTypeClasses(main); // ASC-HOOK loadEager — page-type body classes
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  ascLazy(); // ASC-HOOK loadLazy — SEO + speculation rules

  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  // ASC-HOOK:start loadLazy chrome gating — gate header/footer on chromeless shares
  if (!isChromeless(main)) {
    loadHeader(doc.querySelector('header'));
    loadFooter(doc.querySelector('footer'));
  }
  // ASC-HOOK:end loadLazy chrome gating

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  ascDelayed(); // ASC-HOOK loadDelayed
  window.setTimeout(() => import('./delayed.js'), 3000);
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
