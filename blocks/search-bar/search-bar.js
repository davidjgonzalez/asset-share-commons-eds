/** @owner user */
/**
 * search-bar — full-text search input with display-mode and sort controls.
 *
 * Authoring (da.live table):
 *
 *   | search-bar   |                                                     |
 *   | redirect     | /search                                             |  ← optional: cross-page redirect
 *   | placeholder  | Search assets...                                   |  ← optional input placeholder
 *   | view         | Masonry : masonry                                  |  ← first option = default
 *   |              | Cards : cards                                      |
 *   |              | List : list                                        |
 *   | sort         | Relevance : @jcr:score                             |  ← first option = default
 *   |              | Created : @jcr:created                             |
 *   |              | Title : @jcr:content/metadata/dc:title             |
 *   | order        | Descending : desc                                  |  ← first option = default
 *   |              | Ascending : asc                                    |
 *   | color-search | false                                               |  ← optional: hide the color-search control
 *                                                                            (off by default; enable with
 *                                                                            configurations.js search.colorSearch.enabled: true)
 *
 *   Each option is authored as "Label : value" on its own paragraph within the cell.
 *   The first option listed becomes the default when nothing is stored in localStorage.
 *   Priority: URL param > localStorage > first authored option.
 */
import { readBlockConfig, SEARCH_FORM } from '../../scripts/asc/core/utils/search.js';
import { filterAttrs, decodeInitialText } from '../../scripts/asc/core/services/search/request.js';
import { escAttr } from '../../scripts/asc/core/utils/html.js';
import { DEFAULT_PALETTE, nearestColor } from './color-search.js';
import services from '../../scripts/asc/core/services/services.js';
import { icon } from '../../scripts/asc/core/utils/icons.js';

const configurations = (await import('../../scripts/asc/configurations.js')).default;
const SEARCH_PAGE = configurations.search?.page || '';
const COLOR_SEARCH_ENABLED = configurations.search?.colorSearch?.enabled === true;
const COLOR_PALETTE = configurations.search?.colorSearch?.palette || DEFAULT_PALETTE;

const LS_DISPLAY = 'asc.search-results.display';
const LS_ORDERBY = 'asc.orderby';
const LS_ORDERBY_SORT = 'asc.orderby.sort';
const LS_COLOR = 'asc.search.color';

const SUPPORTS_POPOVER = 'popover' in HTMLElement.prototype;

const DEFAULT_VIEW_OPTIONS = [
  { label: 'Masonry', value: 'masonry' },
  { label: 'Cards', value: 'cards' },
  { label: 'List', value: 'list' },
];
// Values are the neutral sort vocabulary (see services/search/request.js SORT_FIELDS);
// each provider maps them to its own order field. Add `Modified : modified` if wanted.
const DEFAULT_SORT_OPTIONS = [
  { label: 'Relevance', value: 'relevance' },
  { label: 'Created', value: 'created' },
  { label: 'Title', value: 'title' },
];
const DEFAULT_ORDER_OPTIONS = [
  { label: 'Descending', value: 'desc' },
  { label: 'Ascending', value: 'asc' },
];

// Display mode icons — keyed to the option value
const ICONS = {
  cards:    icon('viewCards', { size: 15 }),
  masonry:  icon('viewMasonry', { size: 15 }),
  list:     icon('viewList', { size: 15 }),
  sortField:icon('sortField', { size: 15 }),
  asc:      icon('arrowUp', { size: 14, strokeWidth: 2.5 }),
  desc:     icon('arrowDown', { size: 14, strokeWidth: 2.5 }),
};

/**
 * Parse authored option rows into [{label, value}] pairs.
 * raw is a string (single <p>) or array of strings (multiple <p> in one cell).
 * Each string is "Label : value"; splits on first colon only.
 */
function parseOptions(raw, defaults) {
  if (!raw) return defaults;
  const items = Array.isArray(raw) ? raw : [raw];
  const parsed = items
    .map((item) => {
      const i = item.indexOf(':');
      if (i === -1) return { label: item.trim(), value: item.trim() };
      return { label: item.slice(0, i).trim(), value: item.slice(i + 1).trim() };
    })
    .filter((o) => o.label && o.value);
  return parsed.length ? parsed : defaults;
}

export default function decorate(block) {
  const config = readBlockConfig(block, {}, {
    placeholder: 'Search assets...',
    inputType: 'search',
    redirect: SEARCH_PAGE,
  });
  // A `redirect` row may have been pasted as a full URL copied from a different
  // environment (aem.live/aem.page/localhost) — only its path/query is ever valid.
  config.redirect = services.url.toRelativeUrl(config.redirect);

  const viewOptions    = parseOptions(config.view,        DEFAULT_VIEW_OPTIONS);
  const sortOptions    = parseOptions(config.sort,        DEFAULT_SORT_OPTIONS);
  const orderOptions   = parseOptions(config.order,       DEFAULT_ORDER_OPTIONS);

  // Display mode: localStorage only, never part of the shareable URL.
  // Sort/order: URL param > localStorage > first authored option (unchanged).
  const params = new URLSearchParams(window.location.search);
  // Clamp against a stale/removed value (e.g. a leftover "board" from before
  // that mode existed) rather than trusting localStorage blindly.
  const storedDisplay = localStorage.getItem(LS_DISPLAY);
  const display = viewOptions.some((o) => o.value === storedDisplay) ? storedDisplay : viewOptions[0].value;
  // Sort rides in the neutral URL as `sort=field:direction`. Priority: URL > LS > first option.
  const [urlSortField, urlSortDir] = (params.get('sort') || '').split(':');
  const orderby    = urlSortField || localStorage.getItem(LS_ORDERBY)    || sortOptions[0].value;
  const orderbySort= urlSortDir   || localStorage.getItem(LS_ORDERBY_SORT) || orderOptions[0].value;
  const colorSearchEnabled = COLOR_SEARCH_ENABLED && config['color-search'] !== 'false';
  const color = colorSearchEnabled ? (localStorage.getItem(LS_COLOR) || '') : '';

  block.innerHTML = html(config, {
    display, orderby, orderbySort, viewOptions, sortOptions, orderOptions,
    colorSearchEnabled, color,
  });
  addEventListeners(block, config);

  if (block.querySelector('input[type="search"]').value.trim()) {
    document.dispatchEvent(new CustomEvent('asc:search:execute'));
  }
}

function optionHtml(opts, selected) {
  return opts.map(({ label, value }) =>
    `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`
  ).join('');
}

function html(config, {
  display, orderby, orderbySort, viewOptions, sortOptions, orderOptions,
  colorSearchEnabled, color,
}) {
  const initial = decodeInitialText();

  return `
    <div class="asc-ui-search">
      <input type="${config.inputType}" placeholder="${config.placeholder}"
             form="${config.form}"
             value="${escAttr(initial)}"
             data-asc-search-text>

      ${colorSearchEnabled ? `
      <input type="hidden" class="search-bar__color-value" ${filterAttrs({ id: 'color', type: 'color', field: '', op: 'equals' })} form="${SEARCH_FORM}" value="${escAttr(color)}">
      <div class="asc-ui-search__action search-bar__ctrl--color">
        <div class="asc-ui-dropdown" title="Search by color">
          <button type="button" class="search-bar__color-trigger" aria-expanded="false" aria-controls="search-bar-color-panel" aria-label="Search by color"${SUPPORTS_POPOVER ? ' popovertarget="search-bar-color-panel"' : ''}>
            <span class="asc-ui-swatch__dot"${color ? ` style="--asc-ui-swatch-color:${escAttr(color)}"` : ''}></span>
          </button>
          <div class="asc-ui-dropdown__panel asc-ui-color-picker" id="search-bar-color-panel"${SUPPORTS_POPOVER ? ' popover="auto"' : ' hidden'}>
            <input type="color" class="asc-ui-color-picker__input" value="${color || '#2980b9'}" aria-label="Pick a color">
            <div class="asc-ui-color-picker__presets">
              ${COLOR_PALETTE.map(({ label, hex }) =>
                `<button type="button" class="asc-ui-color-picker__preset" style="--asc-ui-swatch-color:${escAttr(hex)}" data-color="${escAttr(hex)}" title="${escAttr(label)}"></button>`).join('')}
            </div>
            <hr class="asc-ui-menu__separator">
            <button type="button" class="btn btn--ghost btn--sm asc-ui-color-picker__clear">Clear color</button>
          </div>
        </div>
      </div>` : ''}
    </div>

    <div class="asc-ui-segmented asc-ui-segmented--sm asc-ui-segmented--icon search-bar__controls" role="group" aria-label="Search controls">
      <label class="asc-ui-segmented__option search-bar__ctrl" title="View">
        <span aria-hidden="true">${ICONS[display] || ICONS.masonry}</span>
        <select name="asc.search-results.display" aria-label="View">
          ${optionHtml(viewOptions, display)}
        </select>
      </label>

      <label class="asc-ui-segmented__option search-bar__ctrl" title="Sort by">
        <span aria-hidden="true">${ICONS.sortField}</span>
        <select name="orderby" form="${SEARCH_FORM}" aria-label="Sort by" data-asc-search-sort>
          ${optionHtml(sortOptions, orderby)}
        </select>
      </label>

      <label class="asc-ui-segmented__option search-bar__ctrl" title="Sort direction">
        <span aria-hidden="true">${ICONS[orderbySort] || ICONS.desc}</span>
        <select name="orderby.sort" form="${SEARCH_FORM}" aria-label="Sort direction" data-asc-search-dir>
          ${optionHtml(orderOptions, orderbySort)}
        </select>
      </label>
    </div>
  `;
}

function addEventListeners(block, config) {
  const input = block.querySelector('input[type="search"]');

  let debounceTimer;
  input.addEventListener('input', () => {
    if (needsRedirect(config)) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      document.dispatchEvent(new CustomEvent('asc:search:execute'));
    }, 300);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (needsRedirect(config)) {
      redirectToSearch(config, input.value);
    } else {
      document.dispatchEvent(new CustomEvent('asc:search:execute'));
    }
  });

  block.querySelectorAll('.search-bar__ctrl select').forEach((select) => {
    select.addEventListener('change', () => {
      const val = select.value;
      const iconSpan = select.previousElementSibling;

      if (select.name === 'asc.search-results.display') {
        localStorage.setItem(LS_DISPLAY, val);
        iconSpan.innerHTML = ICONS[val] || ICONS.masonry;
      } else if (select.name === 'orderby') {
        localStorage.setItem(LS_ORDERBY, val);
      } else if (select.name === 'orderby.sort') {
        localStorage.setItem(LS_ORDERBY_SORT, val);
        iconSpan.innerHTML = ICONS[val] || ICONS.desc;
      }
      document.dispatchEvent(new CustomEvent('asc:search:execute', { detail: { type: 'page-load' } }));
    });
  });

  addColorEventListeners(block);
}

function addColorEventListeners(block) {
  const colorDropdown = block.querySelector('.search-bar__ctrl--color');
  if (!colorDropdown) return;

  const trigger = colorDropdown.querySelector('.search-bar__color-trigger');
  const panel = colorDropdown.querySelector('.asc-ui-dropdown__panel');
  const colorInput = colorDropdown.querySelector('.asc-ui-color-picker__input');
  const swatch = colorDropdown.querySelector('.asc-ui-swatch__dot');
  const hiddenField = block.querySelector('.search-bar__color-value');

  const closePanel = () => {
    if (SUPPORTS_POPOVER) {
      panel.hidePopover();
    } else {
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    }
  };

  if (SUPPORTS_POPOVER) {
    // popovertarget handles open/close/light-dismiss/Escape natively. Top-layer promotion
    // breaks the position:relative anchoring from .asc-ui-dropdown, so position it manually.
    panel.addEventListener('toggle', () => {
      const isOpen = panel.matches(':popover-open');
      trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (isOpen) {
        const rect = trigger.getBoundingClientRect();
        panel.style.top = `${rect.bottom + 6}px`;
        panel.style.left = `${rect.left}px`;
      }
    });
  } else {
    trigger.addEventListener('click', () => {
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      panel.hidden = expanded;
      trigger.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    });

    document.addEventListener('click', (event) => {
      if (!colorDropdown.contains(event.target)) closePanel();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closePanel();
    });
  }

  const applyColor = (hex) => {
    const match = nearestColor(hex, COLOR_PALETTE);
    colorInput.value = match.hex;
    swatch.style.setProperty('--asc-ui-swatch-color', match.hex);
    hiddenField.value = match.hex;
    localStorage.setItem(LS_COLOR, match.hex);
    document.dispatchEvent(new CustomEvent('asc:search:execute', { detail: { type: 'page-load' } }));
  };

  let colorDebounce;
  colorInput.addEventListener('input', () => {
    clearTimeout(colorDebounce);
    colorDebounce = setTimeout(() => applyColor(colorInput.value), 300);
  });

  colorDropdown.querySelectorAll('.asc-ui-color-picker__preset').forEach((preset) => {
    preset.addEventListener('click', () => {
      applyColor(preset.dataset.color);
      closePanel();
    });
  });

  colorDropdown.querySelector('.asc-ui-color-picker__clear').addEventListener('click', () => {
    hiddenField.value = '';
    swatch.style.removeProperty('--asc-ui-swatch-color');
    localStorage.removeItem(LS_COLOR);
    closePanel();
    document.dispatchEvent(new CustomEvent('asc:search:execute', { detail: { type: 'page-load' } }));
  });
}

function needsRedirect(config) {
  if (!config.redirect) return false;
  const target = new URL(config.redirect, window.location.origin).pathname.replace(/\/$/, '');
  const current = window.location.pathname.replace(/\/$/, '');
  return current !== target;
}

function redirectToSearch(config, value) {
  const url = new URL(config.redirect, window.location.origin);
  // The search page reads the neutral URL codec — free text rides in `q`.
  if (value.trim()) url.searchParams.set('q', value.trim());
  window.location.href = url.toString();
}
