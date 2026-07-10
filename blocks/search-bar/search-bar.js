/** @owner user */
/**
 * search-bar — full-text search input.
 *
 * Provider compatibility:
 *   QueryBuilder → fulltext predicate
 *   OpenAPI      → q parameter (mapped in openapi.js)
 *
 * Authoring (da.live table):
 *
 *   | search-bar |             |
 *   | redirect   | /           |   ← optional: navigate here when searching from
 *   |            |             |     a different page. Omit to live-search in place.
 *   | placeholder | Search...  |   ← optional input placeholder
 */
import { readBlockConfig } from '../../scripts/asc/core/utils/search.js';

const configurations = (await import('../../scripts/asc/configurations.js')).default;
const SEARCH_PAGE = configurations.search?.page || '';

export default function decorate(block) {
  block.classList.add('asc-ui-search');

  const config = readBlockConfig(block, {}, {
    placeholder: 'Search assets...',
    inputType: 'search',
    name: 'fulltext',
    // Block-level `redirect` row wins; fall back to the global search.page.
    redirect: SEARCH_PAGE,
  });

  block.innerHTML = html(config);
  addEventListeners(block, config);

  // Auto-execute search when pre-populated from a redirect URL.
  if (block.querySelector('input').value.trim()) {
    document.dispatchEvent(new CustomEvent('asc:search:execute'));
  }
}

function html(config) {
  // Standard group-keyed initial value (same page), falling back to the bare
  // param name used when arriving via a cross-page redirect.
  const initial = config.initial[`${config.group}_group.${config.name}`]
    || new URLSearchParams(window.location.search).get(config.name)
    || '';
  return `
    <input type="${config.inputType}" placeholder="${config.placeholder}"
        form="${config.form}"
        name="${config.field}"
        value="${initial}"
        data-asc-filter="${config.id}">
  `;
}

function addEventListeners(block, config) {
  const input = block.querySelector('input');

  // Live search — debounced so rapid typing only searches once the user pauses.
  let debounceTimer;
  input.addEventListener('input', () => {
    if (needsRedirect(config)) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      document.dispatchEvent(new CustomEvent('asc:search:execute'));
    }, 300);
  });

  // Enter key — navigates cross-page or triggers in-place search.
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (needsRedirect(config)) {
      redirectToSearch(config, input.value);
    } else {
      document.dispatchEvent(new CustomEvent('asc:search:execute'));
    }
  });

  const button = block.querySelector('button');
  if (button) {
    button.addEventListener('click', () => {
      if (needsRedirect(config)) {
        redirectToSearch(config, input.value);
      } else {
        document.dispatchEvent(new CustomEvent('asc:search:execute'));
      }
    });
  }
}

/** True when a redirect is configured and the current page is not that page. */
function needsRedirect(config) {
  if (!config.redirect) return false;
  const target = new URL(config.redirect, window.location.origin).pathname.replace(/\/$/, '');
  const current = window.location.pathname.replace(/\/$/, '');
  return current !== target;
}

/** Navigate to the redirect URL, appending the query as a bare `?{name}=` param. */
function redirectToSearch(config, value) {
  const url = new URL(config.redirect, window.location.origin);
  if (value.trim()) url.searchParams.set(config.name, value.trim());
  window.location.href = url.toString();
}
