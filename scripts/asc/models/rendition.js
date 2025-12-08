class Rendition {
  constructor({ asset, id, label, description, visible, mimeType, format, usecase, url, fileSize, width, height, type, path }) {
    // Simple data as direct properties
    this.asset = asset;
    this.id = id;
    this.name = id;
    this.label = label;
    this.description = description;
    this.visible = visible;
    this.mimeType = mimeType;
    this.format = format;
    this.usecase = usecase;
    this.url = url;
    this.fileSize = fileSize;
    this.width = width;
    this.height = height;
    this.type = type;
    this.path = path;
  }

  /**
   * Make the rendition iterable for destructuring and spreading
   * @returns {Object} Iterator with key-value pairs
   */
  *[Symbol.iterator]() {
    for (const [key, value] of Object.entries(this)) {
      yield [key, value];
    }
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

}

export default Rendition;