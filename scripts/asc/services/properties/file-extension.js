import serviceConfigurations from "../configurations.js";

const config = { 
    ...serviceConfigurations.properties?.configs?.['file-extension'] || {},
}

export default function get(asset, options = {}) {
    return asset.getFilename().split('.').pop() || null;
}