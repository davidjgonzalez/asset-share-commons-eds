// ASC Core — do not edit. Customize via scripts/asc/configurations.js
/*
 * Fragment Block
 * Include content on a page as a fragment.
 * https://www.aem.live/developer/block-collection/fragment
 */

import {
  decorateMain,
} from '../../../scripts.js';

import {
  loadSections,
} from '../../../aem.js';

/**
 * Loads a fragment.
 * @param {string} path The path to the fragment
 * @returns {HTMLElement} The root element of the fragment
 */
export async function loadFragment(path, attrs = {}) {
  if (path && path.startsWith('/')) {
    const first = await fetch(`${path}.plain.html`);
    const resp = first.status === 200 ? first : await fetch(`${path}/index.plain.html`);
    if (resp.ok) {
      /* +++ Begin customization of OOTB loadFragment +++ */
      /* Loading a Folder Map Fragment includes the FULL HTML document, extract the main element */
      const main = document.createElement('main');
      main.innerHTML = await resp.text();

      Object.entries(attrs).forEach(([selector, attributes]) => {
        const els = main.matches(selector) ? [main, ...main.querySelectorAll(`:scope ${selector}`)] : main.querySelectorAll(`:scope ${selector}`);
        els.forEach((el) => {
          Object.entries(attributes).forEach(([attr, val]) => {
            el.setAttribute(attr, val);
          });
        });
      });
      /* --- End customization of OOTB loadFragment --- */

      // reset base path for media to fragment base
      const resetAttributeBase = (tag, attr) => {
        main.querySelectorAll(`${tag}[${attr}^="./media_"]`).forEach((elem) => {
          elem[attr] = new URL(elem.getAttribute(attr), new URL(path, window.location)).href;
        });
      };
      resetAttributeBase('img', 'src');
      resetAttributeBase('source', 'srcset');

      decorateMain(main);
      await loadSections(main);
      return main;
    }
  }
  return null;
}
