// ASC Core — do not edit. Customize via scripts/configurations.js
import serviceConfigurations from "../configurations.js";

const config = { 
    ...serviceConfigurations.properties?.configs?.['file-size'] || {},
}

export default function get(asset, options = {}) {
    const bytes = asset.getProperty('dam:size');

    if (bytes) {
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        let value = bytes / Math.pow(k, i);

        if (sizes[i] === 'GB') {
            value = Math.ceil(value * 10) / 10;
        } else if (sizes[i] === 'Bytes') {
            // exact byte count, no rounding
        } else {
            value = Math.ceil(value);
        }

        return value + ' ' + sizes[i];
    }

    return null;
}
