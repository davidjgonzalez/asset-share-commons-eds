import serviceConfigurations from "../configurations.js";

const config = { 
    ...serviceConfigurations.properties?.configs?.['width'] || {},
}

export default function get(asset, options = {}) {
   return asset.getProperty('tiff:ImageWidth') || asset.getProperty('exif:PixelXDimension');
}