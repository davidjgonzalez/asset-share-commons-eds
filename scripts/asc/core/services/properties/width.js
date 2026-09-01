// ASC Core — do not edit. Customize via scripts/asc/configurations.js
import serviceConfigurations from "../configurations.js";

const config = { 
    ...serviceConfigurations.properties?.configs?.['width'] || {},
}

export default function get(asset, options = {}) {
   return asset.getProperty('tiff:ImageWidth').data
    || asset.getProperty('exif:PixelXDimension').data
    || asset.getProperty('dam:extractedWidth').data;
}
