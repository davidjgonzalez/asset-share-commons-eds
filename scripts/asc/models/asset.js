import services from "../services/services.js";

export default class Asset {
  constructor(data) {
    this.data = data;
    this.metadata = data["jcr:content"]["metadata"];
  }

  static async create(input) {
    let id;

    if (input instanceof Element) {
      // If input is an HTMLElement, look up the DOM tree for the data-asc-asset-id attribute
      let element = input;
      while (element && !element.hasAttribute('data-asc-asset-id')) {
        element = element.parentElement;
      }
      
      if (element) {
        id = element.getAttribute('data-asc-asset-id');
      } else {
        console.warn("No data-asc-asset-id attribute found in DOM tree for element:", input);
        return null;
      }
    } else if (typeof input === "object" && input.pathname) {
      if (input.pathname.startsWith("/details")) {
        id = input.pathname.split("/").pop();
      } else {
        console.warn("Unable to create Asset from input: ", input);
        return null;
      }
    } else {
      return new Asset(input);
    }
    


    
    return await services.search.getAssetById(id);
  }

  getPath() {
    return this.data["jcr:path"];
  }

  getUuid() {
    return this.data["jcr:uuid"];
  }

  getId() {
    return this.getUuid();
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
          typeof value === "object" &&
          value["jcr:primaryType"] === "nt:file" &&
          value["jcr:content"]
        ) {
          let renditionAttributes = {};

          if (value["jcr:content"]["metadata"]) {
            renditionAttributes = {
              mimeType: value["jcr:content"]["metadata"]["dc:format"] || null,
              fileSize: value["jcr:content"]["metadata"]["dam:size"] || null,
              width:
                value["jcr:content"]["metadata"]["tiff:ImageWidth"] || null,
              height:
                value["jcr:content"]["metadata"]["tiff:ImageLength"] || null,
            };
          } else if (key === "original") {
            // Special case for original
            renditionAttributes = {
              mimeType: this.getMimeType() || null,
              fileSize: this.getSizeInBytes() || null,
              width: this.getProperty("tiff:ImageWidth") || null,
              height: this.getProperty("tiff:ImageLength") || null,
            };
          } else {
            // given a key like cq5dam.thumbnail.319.319.png, parse the mime type and dimensions
            const width = key.split(".")[2];
            const height = key.split(".")[3];

            renditionAttributes = {
              mimeType: services.fileType.getMimeType(key),
              fileSize: null,
              width: width,
              height: height,
            };
          }

          renditions.push({
            name: key,
            path: `${this.getPath()}/jcr:content/renditions/${key}`,
            url: services.aem.getUrl(
              `${this.getPath()}/_jcr_content/renditions/${key}`
            ),
            ...renditionAttributes,
          });
        }
      });
    }
    return renditions;
  }

  getProperty(property, options = {}) {
    if (!property) {
      return null;
    }

    if (services?.properties?.[property]) {
      return services.properties[property](this, options);
    }

    // If property starts with metadata then add jcr:content to the beginning, so the next logic block can be used to follow the relative path
    if (property.startsWith("metadata/")) {
      property = `jcr:content/${property}`;
    }

    // If property starts with jcr:content then follow the relative path to get the value from this.data
    if (property.startsWith("jcr:content/")) {
      const parts = property.split("/");
      let value = this.data;
      for (const part of parts) {
        value = value[part];
      }
      return value;
    }

    // Else its probably a property on the metadata, jcr:content, or dam:Asset resource
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

  getPictureHtml(options = {}) {
    if (!services.aem.isLocalhost()) {
      return `<div>NOT IMPLEMENTED; USE DYNAMIC URLS</div>`;
    }

    // Refactored options: allow passing alt, eager, breakpoints, sizes, imgAttributes
    const {
      alt = null, // Optional alt override
      eager = false, // If true, loading="eager"
      breakpoints = null, // Custom breakpoints: [{ width: 768, renditionWidth: 400 }, ...]
      sizes = null, // Optional sizes attribute for <img>
      imgAttributes = {}, // Additional attributes for <img>
    } = options;

    let imageRenditions = this.getRenditions()
      .filter(
        (r) =>
          /cq5dam\.(thumbnail|web|zoom)\.\d+\.\d+\.(png|jpg|jpeg|gif|webp)/.test(
            r.name
          ) && r.mimeType?.includes("image/")
      )
      .sort((a, b) => b.width - a.width);

    if (!imageRenditions.length)
      return "<div>No suitable image renditions found</div>";

    let sources;
    if (breakpoints) {
      // Use custom breakpoints
      sources = breakpoints
        .map((bp) => {
          const rendition =
            imageRenditions.find((r) => r.width <= bp.renditionWidth) ||
            imageRenditions[imageRenditions.length - 1];
          return `<source srcset="${rendition.url}" type="${rendition.mimeType}" media="(min-width: ${bp.width}px)" />`;
        })
        .join("\n");
    } else {
      // Use automatic breakpoints based on rendition widths
      sources = imageRenditions
        .map((r, index) => {
          const nextRendition = imageRenditions[index + 1];
          const minWidth = nextRendition ? nextRendition.width : 0;
          const maxWidth = r.width;

          let mediaQuery;
          if (index === 0) {
            mediaQuery = `(min-width: ${minWidth + 1}px)`;
          } else if (index === imageRenditions.length - 1) {
            mediaQuery = `(max-width: ${maxWidth}px)`;
          } else {
            mediaQuery = `(min-width: ${
              minWidth + 1
            }px) and (max-width: ${maxWidth}px)`;
          }

          return `<source srcset="${r.url}" type="${r.mimeType}" media="${mediaQuery}" />`;
        })
        .join("\n");
    }

    // Fallback image: use the smallest (last) rendition
    const fallbackImg = imageRenditions[imageRenditions.length - 1];

    // Build img attributes
    const imgAttrs = {
      alt: alt !== null ? alt : this.getTitle(),
      loading: eager ? "eager" : "lazy",
      fetchpriority: eager ? "high" : "auto",
      src: fallbackImg.url,
      style:
        fallbackImg.width && fallbackImg.height
          ? `aspect-ratio: ${fallbackImg.width}/${fallbackImg.height}; width: 100%; object-fit: cover;`
          : "width: 100%; object-fit: cover;",
      ...imgAttributes,
    };

    if (sizes) {
      imgAttrs.sizes = sizes;
    }

    const imgAttrString = Object.entries(imgAttrs)
      .map(([key, value]) => `${key}="${value}"`)
      .join(" ");

    return `<picture>
      ${sources}
      <img ${imgAttrString} />
    </picture>`;
  }
}
