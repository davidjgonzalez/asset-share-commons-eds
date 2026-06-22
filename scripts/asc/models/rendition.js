// ASC Core — do not edit. Customize via scripts/configurations.js
class Rendition {
  constructor({ asset, id, label, description, visible, mimeType, format, fileType, usecase, url, fileSize, width, height, type, path }) {
    // Simple data as direct properties
    this.asset = asset;
    this.id = id;
    this.name = id;
    this.label = Rendition.deriveLabel(label);
    this.description = description;
    this.visible = visible;
    this.mimeType = mimeType;
    this.format = format;
    this.fileType = fileType;
    this.usecase = usecase;
    this.url = (id === 'original' && asset?.url) ? asset.url : url;
    this.fileSize = fileSize;
    this.width = width;
    this.height = height;
    this.type = type;
    this.path = path;
  }

  static async create(asset, renditionId) {
    if(typeof asset === 'string') {
      asset = await Asset.create(asset);
    } else if (asset instanceof Asset) {
      asset = asset;
    } else {
      throw new Error('Invalid asset');
    }

    const rendition = asset.getRendition(renditionId);
    if(!rendition) {
      throw new Error('Rendition not found');
    }

    return new Rendition(rendition);
  }

  /**
   * Convert rendition to plain object for spreading
   * Includes both direct properties and any getter properties
   * @returns {Object} Plain object representation
   */
  toObject() {
    const obj = { ...this }; // Get all direct properties
    
    // Add any getter properties from the prototype
    const proto = Object.getPrototypeOf(this);
    const descriptors = Object.getOwnPropertyDescriptors(proto);
    
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor.get && key !== 'constructor') {
        obj[key] = this[key]; // Call the getter
      }
    }
    
    return obj;
  }

  /**
   * Convert to JSON-serializable object
   * @returns {Object} Plain object suitable for JSON.stringify
   */
  toJSON() {
    return this.toObject();
  }

  /**
   * Derive a human-readable display label from a raw JCR rendition node name.
   *
   * Rules (applied in order):
   *  1. Strip the file extension
   *  2. Strip AEM node-name prefixes: cq5dam. / cqdam.
   *  3. Strip a trailing pair of numeric segments (e.g. .1280.1280, .48.48)
   *
   * Human-readable labels (e.g. "Web", "Smart Crop — Small") are returned unchanged.
   */
  static deriveLabel(raw) {
    if (!raw) return raw;
    let name = String(raw);
    name = name.replace(/\.[a-zA-Z][a-zA-Z0-9]*$/, '');   // 1. strip extension
    name = name.replace(/^cq5?dam\./, '');                  // 2. strip prefix
    name = name.replace(/\.\d+\.\d+$/, '');                 // 3. strip trailing number pair
    return name || raw;
  }

}

export default Rendition;
