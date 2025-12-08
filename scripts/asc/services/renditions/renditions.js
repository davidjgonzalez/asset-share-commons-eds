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

import serviceConfigurations from "../configurations.js";
import services from "../services.js";
import Rendition from "../../models/rendition.js";

const DEFAULT_RENDITION_DEFINITIONS = [
  {
    id: "thumbnail",
    label: "Thumbnail",
    description: "A thumbnail image for the asset used for X usually.",
    visible: false,
    format: "image", // image, video, audio, document, etc. -- not sure what the details yet
    accepts: (asset) => true,
    get: (asset) =>
      services.renditions
        .getStaticRenditions(asset)
        ?.find((r) => r.id?.startsWith("cq5dam.thumbnail.*.jpg")),
  },
  {
    id: "thumbnail",
    label: "Thumbnail",
    description: "A thumbnail image for the asset used for X usually.",
    visible: false,
    format: "video", // image, video, audio, document, etc. -- not sure what the details yet
    usecase: "website",
    accepts: (asset) => true,
    get: (asset) =>
      services.renditions
        .getStaticRenditions(asset)
        ?.find((r) => r.id?.startsWith("cq5dam.thumbnail.*.jpg")),
  },
  {
    id: "web",
    label: "Web",
    description: "A thumbnail image for the asset",
    visible: true,
    format: "image", // image, video, audio, document, etc. -- not sure what the details yet
    accepts: (asset) => true,
    get: (asset) =>
      services.renditions
        .getStaticRenditions(asset)
        ?.find((r) => r.id?.startsWith("cq5dam.web.")),
  },
  {
    id: "original",
    label: "Original",
    description: "The original asset",
    visible: true,
    format: "all", // all image, video, audio, document, etc. -- not sure what the details yet
    accepts: (asset) => true,
    get: (asset) =>
      services.renditions
        .getStaticRenditions(asset)
        .find((r) => r.id == "original"),
  },
  /*
    {
        id: 'smart-crop-small',
        label: 'Smart Crop Small',
        description: 'A smart crop small image for the asset',
        visible: true,
        format: 'image', // image, video, audio, document, etc. -- not sure what the details yet
        accepts: (asset) => asset.mimeType?.includes('image/'),
        get: (asset) => new Rendition({ ...this, url: `/asset/smart-crop/small/${asset.uuid}/${asset.filename}` }),
    }*/
];

class Renditions {
  constructor(config) {
    this.config = config;
    this.renditionDefinitions =
      this.config.renditionDefinitions || DEFAULT_RENDITION_DEFINITIONS;
  }

  getRenditionDefinition(id) {
    return this.renditionDefinitions.find((renditionDefinition) => renditionDefinition.id === id);
  }

  getRenditions(asset) {
    return this.renditionDefinitions
      .filter((renditionDefinition) => renditionDefinition.accepts(asset))
      .map((renditionDefinition) => {
        const rendition = renditionDefinition.get(asset);

        if (!rendition) {
          console.debug(`Rendition missing for rendition name [ ${renditionDefinition.id} ]`);
          return null;
        }

        return new Rendition({
          asset,
          id: rendition.id,
          label: rendition.label,
          description: rendition.description,
          visible: rendition.visible,
          mimeType: rendition.mimeType,
          format: rendition.format,
          url: rendition.url,
          ...renditionDefinition,
        });
      })
      .filter((r) => r !== null);
  }

  getRendition(asset, name) {
    return asset.getRendition(name) || [];
  }

  getStaticRenditions(asset) {
    const resource = asset.data["jcr:content"]["renditions"];

    const staticRenditions = [];
    if (resource && typeof resource === "object") {
      Object.entries(resource).forEach(([name, value]) => {
        if (
          typeof value === "object" &&
          value["jcr:primaryType"] === "nt:file" &&
          value["jcr:content"]
        ) {
          let staticRendition = {};

          if (value["jcr:content"]["metadata"]) {
            staticRendition = {
              mimeType: value["jcr:content"]["metadata"]["dc:format"] || null,
              fileSize: value["jcr:content"]["metadata"]["dam:size"] || null,
              width:
                Number.parseInt(
                  value["jcr:content"]["metadata"]["tiff:ImageWidth"]
                ) || null,
              height:
                Number.parseInt(
                  value["jcr:content"]["metadata"]["tiff:ImageLength"]
                ) || null,
            };
          } else if (name === "original") {
            // Special case for original
            staticRendition = {
              mimeType: asset.mimeType || null,
              fileSize: asset.sizeInBytes || null,
              width: asset.getProperty("tiff:ImageWidth") || null,
              height: asset.getProperty("tiff:ImageLength") || null,
            };
          } else {
            // given a key like cq5dam.thumbnail.319.319.png, parse the mime type and dimensions
            const width = name.split(".")[2];
            const height = name.split(".")[3];

            staticRendition = {
              id: name,
              name: name,
              mimeType: services.fileType.getMimeType(name),
              fileSize: null,
              width: width,
              height: height,
            };
          }

          const rendition = new Rendition({
            asset: asset,
            id: name,
            name: name,
            label: name,
            description: "AEM static rendition",
            width: staticRendition.width,
            height: staticRendition.height,
            fileSize: staticRendition.fileSize,
            mimeType: staticRendition.mimeType,
            path: `${asset.path}/jcr:content/renditions/${name}`,
            url: services.aem.getUrl(
              `${asset.path}/_jcr_content/renditions/${name}`
            ),
          });

          staticRenditions.push(rendition);
        }
      });
    }
    return staticRenditions || [];
  }
}

export default new Renditions(serviceConfigurations.renditions || {});
