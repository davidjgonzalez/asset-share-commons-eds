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

        // If GB or B, show 1 decimal; if KB or MB, round to whole number
        if (sizes[i] === 'GB' || sizes[i] === 'Bytes') {
            value = Math.round(value * 10) / 10;
        } else {
            value = Math.round(value);
        }

        return value + ' ' + sizes[i];
    }

    return null;
}