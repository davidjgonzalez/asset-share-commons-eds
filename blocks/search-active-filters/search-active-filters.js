/** @owner user */
/**
 * search-active-filters — displays active search filter values as dismissible pills.
 *
 * Renders once on `asc:blocks:loaded` (all filter blocks have restored their
 * initial checked/value state from the URL by then) and again after every
 * search via `asc:search:complete`. Rendering on blocks:loaded — rather than
 * waiting for the first search round-trip — matters because this block gets
 * teleported into the sticky header, whose height reacts to whether it's
 * empty (see search-active-filters.css); populating pills only after the
 * network search resolves means the header visibly grows/shifts the page
 * after first paint. Doing it as soon as blocks are loaded (synchronous,
 * local DOM read) sets the header's real height before that first paint.
 * Reads active state directly from the DOM ([data-asc-filter] inputs) so
 * it picks up initial URL-restored values without any extra wiring.
 *
 * Pill removal dispatches `asc:search:execute` — the same event every filter
 * block uses, so the search re-runs and all blocks stay in sync.
 *
 * Inputs NOT shown as pills (intentionally):
 *   - type="hidden" inputs (e.g. the color filter)
 *   - The free-text search-bar input (has data-asc-search-text, not data-asc-filter)
 *
 * Authoring: no configuration rows needed; just add the block to any search page.
 */

import { SEARCH_FORM } from '../../scripts/asc/core/utils/search.js';
import { mountToHeader } from '../../scripts/asc/core/utils/header-mount.js';

export default function decorate(block) {
  document.addEventListener('asc:blocks:loaded', () => update(block), { once: true });
  document.addEventListener('asc:search:complete', () => update(block));

  block.addEventListener('click', (e) => {
    const pill = e.target.closest('[data-filter-id]');
    if (pill) {
      removeFilter(pill.dataset.filterId, pill.dataset.filterValue, pill.dataset.filterType);
      return;
    }
    if (e.target.closest('.search-active-filters__clear-all')) {
      clearAllFilters();
    }
  });

  // Teleport into the sticky header so pills remain visible on scroll.
  const section = block.closest('.section');
  mountToHeader(block, () => {
    if (section && !section.querySelector('.block')) section.remove();
  });
}

function update(block) {
  const filters = collectActiveFilters();

  if (!filters.length) {
    block.innerHTML = '';
    return;
  }

  block.innerHTML = `
    <ul class="search-active-filters__list asc-ui-chip-list" role="list">
      ${filters.map(({ id, value, label, type }) => `
        <li>
          <button type="button"
                  class="search-active-filters__pill asc-ui-chip asc-ui-chip--removable"
                  data-filter-id="${esc(id)}"
                  data-filter-value="${esc(value)}"
                  data-filter-type="${esc(type)}"
                  aria-label="Remove filter: ${esc(label)}">
            ${esc(label)}<span class="asc-ui-chip__remove" aria-hidden="true">&#x2715;</span>
          </button>
        </li>`).join('')}
      <li>
        <button type="button"
                class="search-active-filters__clear-all btn btn--ghost btn--sm">
          Clear all
        </button>
      </li>
    </ul>`;
}

function filterId(input) {
  try { return JSON.parse(input.dataset.ascFilter).id; } catch { return null; }
}

function collectActiveFilters() {
  const filters = [];
  const seenRadios = new Set();

  document.querySelectorAll(`[form="${SEARCH_FORM}"][data-asc-filter]`).forEach((input) => {
    const type = input.type?.toLowerCase();
    if (type === 'hidden') return;
    const id = filterId(input);
    if (!id) return;

    if (type === 'checkbox' && input.checked) {
      filters.push({ id, value: input.value, label: labelFor(input), type });
    } else if (type === 'radio' && input.checked) {
      if (seenRadios.has(id)) return;
      seenRadios.add(id);
      filters.push({ id, value: input.value, label: labelFor(input), type });
    } else if (input.tagName === 'SELECT' && input.value) {
      const label = input.options[input.selectedIndex]?.text || input.value;
      filters.push({ id, value: input.value, label, type: 'select' });
    } else if (type === 'date' && input.value) {
      filters.push({ id, value: input.value, label: dateLabelFor(input), type });
    }
  });

  return filters;
}

function labelFor(input) {
  return input.closest('label')?.textContent?.replace(/\s+/g, ' ').trim() || input.value;
}

function dateLabelFor(input) {
  // Parse as local date to avoid UTC timezone-shift when formatting.
  const [y, m, d] = input.value.split('-').map(Number);
  const formatted = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    .format(new Date(y, m - 1, d));
  if (input.dataset.ascBound === 'lower') return `From: ${formatted}`;
  if (input.dataset.ascBound === 'upper') return `To: ${formatted}`;
  return formatted;
}

function inputsForId(id) {
  return [...document.querySelectorAll(`[form="${SEARCH_FORM}"][data-asc-filter]`)]
    .filter((input) => filterId(input) === id);
}

function removeFilter(id, value, type) {
  inputsForId(id).forEach((input) => {
    if (type === 'radio') {
      input.checked = false;
    } else if (type === 'checkbox') {
      if (input.value === value) input.checked = false;
    } else {
      input.value = '';
    }
  });

  document.dispatchEvent(new CustomEvent('asc:search:execute', {
    detail: { form: SEARCH_FORM, source: 'filter' },
  }));
}

function clearAllFilters() {
  document.querySelectorAll(`[form="${SEARCH_FORM}"][data-asc-filter]`).forEach((input) => {
    const type = input.type?.toLowerCase();
    if (type === 'hidden') return;
    if (type === 'checkbox' || type === 'radio') {
      input.checked = false;
    } else {
      input.value = '';
    }
  });

  document.dispatchEvent(new CustomEvent('asc:search:execute', {
    detail: { form: SEARCH_FORM, source: 'filter' },
  }));
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
