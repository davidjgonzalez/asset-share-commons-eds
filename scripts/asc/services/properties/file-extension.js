// ASC Core — do not edit. Customize via scripts/configurations.js
import serviceConfigurations from "../configurations.js";

const config = { 
    ...serviceConfigurations.properties?.configs?.['file-extension'] || {},
}

export default function get(asset, options = {}) {
    return asset.filename?.split('.').pop() || null;
}
