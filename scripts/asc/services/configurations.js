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
const serviceConfigurations = {
  aem: {
    host: "http://localhost:4503",
  },
  debug: {
    debug: true,
  },
  init: {
    preload: true,  
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
    // Custom property implementations or overrides of OOTB properties
    custom: {},
    
    // Configuration options for properties (custom, override, or OOTB)
    configs: {
      // Example configurations for OOTB properties
      'file-type': {
        mimeTypeToLabel: {
          // Custom MIME type mappings
        },
        mediaTypeToLabel: {
          // Custom prefix mappings
        }
      },
      'file-size': {
      },
      'dimensions': {
      }
    }
  },
  url: {

  },
  theme: {
    default: "warm",
  },
};

export default serviceConfigurations;
