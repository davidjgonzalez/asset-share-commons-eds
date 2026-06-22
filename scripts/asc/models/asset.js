// ASC Core — do not edit. Customize via scripts/configurations.js
import services from "../services/services.js";
import Rendition from "./rendition.js";

export default class Asset {
  constructor(data) {
    // Store raw data
    this.data = data;
    this.metadata = data["jcr:content"]["metadata"];

    // Extract commonly used direct properties
    this.path = data["jcr:path"];
    this.uuid = data["jcr:uuid"];
    this.filename =
      data["jcr:content"]["cq:name"] ||
      data["jcr:path"]?.split("/")?.pop() ||
      null;
    const firstVal = (v) => (Array.isArray(v) ? v[0] : v);
    this.title =
      firstVal(data["jcr:content"]["metadata"]["dc:title"]) ||
      data["jcr:content"]["cq:name"] ||
      "Missing title";
    this.description = firstVal(data["jcr:content"]["metadata"]["dc:description"]);
    this.mimeType = data["jcr:content"]["metadata"]["dc:format"];
    this.sizeInBytes = data["jcr:content"]["metadata"]["dam:size"] || null;
    this.created = new Date(data["jcr:content"]["metadata"]["jcr:created"]);
    this.lastModified = new Date(
      data["jcr:content"]["metadata"]["jcr:lastModified"]
    );

    /* Object cache */
    this._renditions = null;
    this._staticRenditions = null;
  }

  static async create(input) {
    let id;

    if (input instanceof Element) {
      // If input is an HTMLElement, look up the DOM tree for the data-asc-asset attribute
      let element = input;
      while (!element?.hasAttribute("data-asc-asset")) {
        element = element.parentElement;
      }

      if (element?.hasAttribute("data-asc-asset")) {
        id = element.getAttribute("data-asc-asset");
      } else {
        console.warn(
          "No `data-asc-asset` attribute found in DOM tree for element:",
          input
        );
        return null;
      }
    } else if (typeof input === "object" && input.pathname) {
      if (input.pathname.startsWith("/details")) {
        id = input.pathname.split("/").pop();
      } else {
        console.warn("Unable to create Asset from input: ", input);
        return null;
      }
    } else if (
      typeof input === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        input
      )
    ) {
      id = input;
    } else {
      return new Asset(input);
    }

    return await services.search.getAssetById(id);
  }

  // Computed properties with logic
  get id() {
    return this.uuid;
  }

  get displaySize() {
    if (!this.sizeInBytes) return "Unknown size";
    const bytes = this.sizeInBytes;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${Math.ceil(bytes / (1024 * 1024))} MB`;
    return `${(Math.ceil((bytes / (1024 * 1024 * 1024)) * 10) / 10).toFixed(1)} GB`;
  }

  get fileExtension() {
    if (!this.filename) return null;
    const match = this.filename.match(/\.([^.]+)$/);
    return match ? match[1].toLowerCase() : null;
  }

  get thumbnail() {
    return services.renditions.getThumbnailUrl(this);
  }

  get url() {
    return services.aem.getUrl(this.path);
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

  get renditions() {
    if (this._renditions != null) return this._renditions;
    this._renditions = services.renditions.getRenditions(this) || [];
    return this._renditions;
  }

  getRendition(name) {
    if (!name) return null;

    if (name instanceof RegExp) {
      return this.renditions.find((r) => name.test(r.name)) || null;
    }
    return this.renditions.find((r) => r.name.includes(name)) || null;
  }

  get staticRenditions() {
    if (this._staticRenditions != null) return this._staticRenditions;

    const resource = this.data["jcr:content"]["renditions"];

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
              mimeType: this.mimeType || null,
              fileSize: this.sizeInBytes || null,
              width: this.getProperty("tiff:ImageWidth") || null,
              height: this.getProperty("tiff:ImageLength") || null,
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
            asset: this,
            id: name,
            name: name,
            label: name,
            description: "AEM static rendition",
            width: staticRendition.width,
            height: staticRendition.height,
            fileSize: staticRendition.fileSize,
            mimeType: staticRendition.mimeType,
            path: `${this.path}/jcr:content/renditions/${name}`,
            url: services.aem.getUrl(
              `${this.path}/_jcr_content/renditions/${name}`
            ),
          });

          staticRenditions.push(rendition);
        }
      });
    }
    this._staticRenditions = staticRenditions;
    return this._staticRenditions;
  }

  /**
   * Make the asset iterable for destructuring and spreading
   * @returns {Object} Iterator with key-value pairs
   */
  *[Symbol.iterator]() {
    for (const [key, value] of Object.entries(this)) {
      yield [key, value];
    }
  }

  /**
   * Convert asset to plain object for spreading
   * @returns {Object} Plain object representation with all properties and computed values
   */
  toObject() {
    return {
      // Direct properties
      id: this.id,
      data: this.data,
      metadata: this.metadata,
      path: this.path,
      uuid: this.uuid,
      filename: this.filename,
      title: this.title,
      description: this.description,
      mimeType: this.mimeType,
      sizeInBytes: this.sizeInBytes,
      created: this.created,
      lastModified: this.lastModified,
    };
  }

  /**
   * Convert to JSON-serializable object
   * @returns {Object} Plain object suitable for JSON.stringify
   */
  toJSON() {
    return this.toObject();
  }
}
