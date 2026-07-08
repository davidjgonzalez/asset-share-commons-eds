// ASC Core — do not edit. Customize via scripts/configurations.js
// Copyright 2025 David G.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     https://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import { readBlockConfig as readGenericBlockConfig, getOptions as getGenericBlockOptions } from './blocks.js';

export const SEARCH_FORM = 'asc-search-form';

// Assigns stable group numbers to filter blocks in first-call order (DOM order,
// since EDS decorates blocks top-to-bottom). Only blocks that call readBlockConfig
// receive a number — non-filter blocks are never counted.
const _groupMap = new WeakMap();
let _groupCounter = 0;

export function getGroup(block) {
  if (!_groupMap.has(block)) _groupMap.set(block, ++_groupCounter);
  return _groupMap.get(block);
}

export function getFieldName({group, name, parameter = ''}) {
  return parameter ? `${group}_group.${name}.${parameter}` : `${group}_group.${name}`;
}

export function getOptions({content = '', initialValues = {}, delimiter = ':', splitter = undefined}) {
  return getGenericBlockOptions({content, initialValues, delimiter, splitter});
}

/**
 * Wire filter inputs (checkboxes, radios, date inputs, selects) inside a search filter
 * block to dispatch `asc:search:execute` when they change.
 *
 * All search filter blocks (search-property, search-path, search-date-range, search-tags)
 * should call this instead of writing their own change listeners.
 *
 * @param {HTMLElement} block  - The block element containing the filter inputs
 * @param {object}      config - Block config (must have a `form` property)
 */
export function addSearchEventListeners(block, config) {
  block.querySelectorAll('input[type="checkbox"], input[type="radio"], input[type="date"], select').forEach((input) => {
    input.addEventListener('change', () => {
      document.dispatchEvent(new CustomEvent('asc:search:execute', {
        detail: { form: config.form, source: 'filter' },
      }));
    });
  });
}

/**
 * Optionally wrap a filter block in a disclosure dropdown when the block is
 * inside a section marked `.inline.dropdowns.search-filters` or
 * `.top.dropdowns.search-filters`. Safe to call unconditionally — no-op on
 * any other page layout.
 *
 * Hidden inputs (QB supporting params with `type="hidden"`) are kept outside
 * the panel so they remain in the DOM whether the dropdown is open or closed.
 *
 * The title element is auto-located as `.{blockName}__title` (derived from the
 * block's own CSS class, which EDS sets to the block folder name). If found,
 * its text becomes the trigger label; the element itself is removed.
 *
 * @param {HTMLElement} block         - The filter block element
 * @param {string}      [fallbackLabel='Filter'] - Label when no title element exists
 */
export function enhanceSearchFilterDropdown(block, fallbackLabel = 'Filter') {
  const inDropdownSection = Boolean(
    block.closest('.section.inline.dropdowns.search-filters')
    || block.closest('.section.top.dropdowns.search-filters'),
  );
  if (!inDropdownSection) return;

  // Derive the title element selector from the block's own CSS class name.
  // EDS always adds the block folder name as a class alongside 'block'.
  const blockName = [...block.classList].find((c) => c !== 'block');
  const titleEl = blockName ? block.querySelector(`:scope > .${blockName}__title`) : null;
  const label = titleEl?.textContent?.trim() || fallbackLabel;
  titleEl?.remove();

  const hiddenInputs = Array.from(block.querySelectorAll(':scope > input[type="hidden"]'));
  const panelContent = Array.from(block.children).filter((el) => !hiddenInputs.includes(el));

  const dropdown = document.createElement('div');
  dropdown.className = 'search-filter-dropdown asc-ui-control asc-ui-dropdown';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'search-filter-dropdown__trigger btn btn--secondary asc-ui-control-btn';
  trigger.setAttribute('aria-expanded', 'false');
  trigger.innerHTML = `<span>${label}</span><span class="search-filter-dropdown__arrow asc-ui-chevron" aria-hidden="true">▾</span>`;

  const panel = document.createElement('div');
  panel.className = 'search-filter-dropdown__panel asc-ui-dropdown__panel';
  panel.hidden = true;
  panel.append(...panelContent);

  const closePanel = () => {
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  };

  trigger.addEventListener('click', () => {
    const expanded = trigger.getAttribute('aria-expanded') === 'true';
    panel.hidden = expanded;
    trigger.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  });

  document.addEventListener('click', (event) => {
    if (!dropdown.contains(event.target)) closePanel();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePanel();
  });

  block.innerHTML = '';
  block.append(...hiddenInputs, dropdown);
  dropdown.append(trigger, panel);
}

export function readBlockConfig(block, transform = {}, defaults = {}) {
    const config = readGenericBlockConfig(block, transform, defaults);
    const group = getGroup(block);

    return {
      ...defaults,
      form: SEARCH_FORM,
      group: group,
      field: getFieldName({group, name: config.name}),
      parameter: (value, index) => { 
        index = (!isNaN(index) && Number(index) >= 0) ? `${Number(index)}_` : '';
        return `${getFieldName({group, name: config.name})}.${index}${value}` 
      },
      fieldset: `${SEARCH_FORM}-${group}_group-${config.name}`,
      initial: getInitialValues(window.location.search, group),
      ...config,
    };
}

export function parseKeyValue(content, delimiter = ':') {
  if (!content) return [];
  
  const lines = content.split('\n').map(line => line.trim()).filter(line => line);
  
  return lines.map(line => {
    const delimiterIndex = line.indexOf(delimiter);
    if (delimiterIndex > -1) {
      return {
        label: line.substring(0, delimiterIndex).trim(),
        value: line.substring(delimiterIndex + 1).trim()
      };
    }
    return {
      label: line,
      value: line
    };
  });
}

// Returns an object of initial values from a params object, matching the group pattern
export function getInitialValues(searchParams, group) {
  // Ensure searchParams is a URLSearchParams instance
  if (!(searchParams instanceof URLSearchParams)) {
    searchParams = new URLSearchParams(searchParams);
  }

  // Build a regex to match keys like: [group]_group.[optional index]name[.([optional index]parameter)]
  const pattern = new RegExp(
    //`^(${group}_group\\.)?(\\d+_)?${name}(\\.(\\d+_)?${parameter})?$`
    `^(${group}_group\\.)(.*)$`
  );

  const result = {};

  for (const [key, value] of searchParams.entries()) {
    if (pattern.test(key) && typeof value === 'string' && value.trim() !== '') {
      if (!result[key]) {
        result[key] = [];
      }
      result[key].push(value);
    } else if (key.startsWith('asc.')) {
      if (!result[key]) {
        result[key] = [];
      }
      result[key].push(value);
    }
  }

  // Convert single-value arrays to just the value
  for (const k in result) {
    if (result[k].length === 1) {
      result[k] = result[k][0];
    }
  }

  return result;
}
