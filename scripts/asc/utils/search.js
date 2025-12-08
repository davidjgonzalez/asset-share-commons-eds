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

export function getGroup(block) {
  return Array.from(document.querySelectorAll('.block')).indexOf(block) + 1;
}

export function getFieldName({group, name, parameter = ''}) {
  return parameter ? `${group}_group.${name}.${parameter}` : `${group}_group.${name}`;
}

export function getOptions({content = '', initialValues = {}, delimiter = ':', splitter = undefined}) {
  return getGenericBlockOptions({content, initialValues, delimiter, splitter});
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
