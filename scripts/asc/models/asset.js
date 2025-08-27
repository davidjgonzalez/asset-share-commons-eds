import services from "../services/services.js";

export default class Asset {
  constructor(data) {
    this.data = data;
    this.metadata = data["jcr:content"]["metadata"];
  }

  static async create(assetMetadata) {
    if (typeof assetMetadata === "object") {
      return new Asset(assetMetadata);
    } else if (typeof assetMetadata === "string") {
      let path;
      let id;

      const searchUrl = services.aem.getUrl("/bin/querybuilder.json");
      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (uuidPattern.test(assetMetadata)) {
        id = assetMetadata;
      } else {
        path = assetMetadata;
      }

      let params;

      if (path) {
        params = new URLSearchParams({
          type: "dam:Asset",
          path: path,
          "p.limit": "1",
          "p.hits": "full",
          "p.nodedepth": "5",
        });
      } else {
        params = new URLSearchParams({
          type: "dam:Asset",
          property: "jcr:uuid",
          "property.value": id,
          "p.limit": "1",
          "p.hits": "full",
          "p.nodedepth": "5",
        });
      }

      const response = await fetch(`${searchUrl}?${params}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return data.hits?.length > 0 ? new Asset(data.hits[0]) : null;
    }
  }

  getPath() {
    return this.data["jcr:path"];
  }

  getUuid() {
    return this.data["jcr:uuid"];
  }

  getFilename() {
    return (
      this.data["jcr:content"]["cq:name"] ||
      this.getPath()?.split("/")?.pop() ||
      null
    );
  }

  getSizeInBytes() {
    return this.getProperty("dam:size") || null;
  }

  getCreated() {
    return new Date(this.data["jcr:content"]["metadata"]["jcr:created"]);
  }

  getLastModified() {
    return new Date(this.data["jcr:content"]["metadata"]["jcr:lastModified"]);
  }

  getTitle() {
    return (
      this.data["jcr:content"]["metadata"]["dc:title"] ||
      this.data["jcr:content"]["cq:name"] ||
      "Missing title"
    );
  }

  getDescription() {
    return this.data["jcr:content"]["metadata"]["dc:description"];
  }

  getThumbnail() {
    if (!services.aem.isLocalhost()) {
      return this.getDynamicUrl({ preferwebp: true, width: 200, quality: 80 });
    } else {
      return this.getRenditions().find((r) =>
        r.name.includes("cq5dam.thumbnail.319.319")
      )?.url;
    }
  }

  getDynamicUrl(params = { preferwebp: true, width: 200, quality: 80 }) {
    // In format /adobe/dynamicmedia/deliver/dm-aid--a38886f7-4537-4791-aa20-3f6ef0ac3fcd/adobestock_175749320.jpg?preferwebp=true&width=1000&quality=80

    const path = `/adobe/dynamicmedia/deliver/dm-aid--${this.getUuid()}/${this.getFilename()}`;

    const url = new URL(path, services.aem.getHost());

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    return url.toString();
  }

  getUrl() {
    return services.aem.getUrl(this.getPath());
  }

  getMimeType() {
    return this.data["jcr:content"]["metadata"]["dc:format"];
  }

  getRenditions() {
    const resource = this.data["jcr:content"]["renditions"];
    const renditions = [];
    if (resource && typeof resource === "object") {
      Object.entries(resource).forEach(([key, value]) => {
        if (
          value &&
          typeof value === "object" &&
          value["jcr:primaryType"] === "nt:file" &&
          value["jcr:content"] &&
          value["jcr:content"]["metadata"] &&
          typeof value["jcr:content"] === "object" &&
          typeof value["jcr:content"]["metadata"] === "object"
        ) {
          renditions.push({
            name: key,
            path: `${this.getPath()}/jcr:content/renditions/${key}`,
            url: services.aem.getUrl(
              `${this.getPath()}/_jcr_content/renditions/${key}`
            ),
            mimeType: value["jcr:content"]["metadata"]["dc:format"] || null,
            fileSize: value["jcr:content"]["metadata"]["dam:size"] || null,
            width: value["jcr:content"]["metadata"]["tiff:ImageWidth"] || null,
            height: value["jcr:content"]["metadata"]["tiff:ImageLength"] || null,
          });
        }
      });
    }

    return renditions;
  }

  getProperty(property) {
    if (services?.properties?.[property]) {
      return services.properties[property](this);
    }

    return (
      this.metadata[property] ||
      this.data["jcr:content"][property] ||
      this.data[property] ||
      null
    );
  }

  getData() {
    return this.data;
  }

  getMetadata() {
    return this.data["jcr:content"]["metadata"];
  }

  /* HTML helpers */

  getPictureHtml() {
    if (!services.aem.isLocalhost()) {
      return `<div>NOT IMPLEMENTED; USE DYNAMIC URLS</div>`;
    }

    const imageRenditions = this.getRenditions()
      .filter(r =>
        /cq5dam\.(thumbnail|web|zoom)\.\d+\.\d+\.(png|jpg|jpeg|gif|webp)/.test(r.name) &&
        r.mimeType?.includes("image/") 
      )
      .sort((a, b) => b.width - a.width);

    if (!imageRenditions.length) return "<div>No image renditions found</div>";

    const webRendition = imageRenditions.find(r => r.name.includes("cq5dam.web.")) || imageRenditions[0];

    const sources = imageRenditions.map(r =>
      `<source srcset="${r.url}" type="${r.mimeType}" media="(min-width: ${r.width}px)" />`
    ).join("\n");

    return `<picture>
      ${sources}
      <img src="${webRendition.url}" alt="${this.getTitle()}" loading="lazy" style="aspect-ratio: ${webRendition.width}/${webRendition.height}; width: 100%; object-fit: cover;" />
    </picture>`;
  }
}
