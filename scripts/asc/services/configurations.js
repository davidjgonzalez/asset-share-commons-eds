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
import properties from "./properties/properties.js";

const serviceConfigurations = {
  aem: {
    host: "http://localhost:4503",
  },
  assetDetails: {

  },
  search: {
    url: "http://localhost:4503/bin/querybuilder.json",
    hits: "full",
    properties: [
      "jcr:path",
      "jcr:content/metadata/dc:title",
      "jcr:content/metadata/dc:description",
      "jcr:content/metadata/dc:format",
    ],
    preprocessQuery: (query) => query,
    postprocessResults: (results) => results,
  },
  properties: {
    computed: {
      ...properties,
      // Add your own properties here
    },
  },
  theme: {
    default: "warm",
  },
};

export default serviceConfigurations;
