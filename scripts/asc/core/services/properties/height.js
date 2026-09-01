// ASC Core — do not edit. Customize via scripts/asc/configurations.js
import serviceConfigurations from "../configurations.js";

const config = { 
    ...serviceConfigurations.properties?.configs?.['height'] || {},
}

export default function get(asset, options = {}) {
    return asset.getProperty('tiff:ImageLength').data
    || asset.getProperty('exif:PixelYDimension').data
    || asset.getProperty('dam:extractedHeight').data;
}
