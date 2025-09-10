import serviceConfigurations from "../configurations.js";

const config = { 
    ...serviceConfigurations.properties?.configs?.['height'] || {},
}

export default function get(asset, options = {}) {
    return asset.getProperty('tiff:ImageLength') || asset.getProperty('exif:PixelYDimension');
}