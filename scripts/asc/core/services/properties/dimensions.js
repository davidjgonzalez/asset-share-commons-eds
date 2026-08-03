// ASC Core — do not edit. Customize via scripts/asc/configurations.js
import getWidth from './width.js';
import getHeight from './height.js';
import serviceConfigurations from "../configurations.js";

const config = { 
    ...serviceConfigurations.properties?.configs?.['dimensions'] || {},
}

export default function get(asset, options = {}) {
    const width = getWidth(asset, options);
    const height = getHeight(asset, options);
    
    if (!width || !height) {
        return null;
    }

    return {
        width: width,
        height: height
    }
}
