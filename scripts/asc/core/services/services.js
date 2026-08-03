// ASC Core — do not edit. Customize via scripts/asc/configurations.js
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

import aem from './aem/aem.js';
import actionPages from './action-pages/action-pages.js';
import actions from './actions/actions.js';
import assetDetails from './asset-details/asset-details.js';
import debug from './debug/debug.js';
import collections from './collections/collections.js';
import downloads from './downloads/downloads.js';
import fileType from './file-type/file-type.js';
import properties from './properties/properties.js';
import renditions from './renditions/renditions.js';
import search from './search/search.js';
import storage from './storage/storage.js';
import url from './url/url.js';
import users from './users/users.js';

/* Import init last */
import init from './init/init.js';

const services = {
  actionPages,
  actions,
  aem,
  assetDetails,
  collections,
  debug,
  downloads,
  fileType,
  init,
  properties,
  renditions,
  search,
  storage,
  url,
  users,
};

export default services;
