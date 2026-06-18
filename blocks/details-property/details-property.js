/** @owner user */
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

import { readBlockConfig } from "../../scripts/aem.js";
import Asset from "../../scripts/asc/models/asset.js";

export default async function decorate(block) {
  const config = readBlockConfig(block);
  const asset = await Asset.create(block);

  // `pill` variant renders the value as a UI Kit badge
  const valueClass = block.classList.contains("pill") ? "asc-ui-badge" : "";
  const value = asset.getProperty(config.property) || config.default;

  block.innerHTML = `
      <label>${config.label}</label>
      <span class="${valueClass}">${value}</span>
    `;
}
