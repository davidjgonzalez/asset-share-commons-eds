import serviceConfigurations from "../configurations.js";
import dimensions from './dimensions.js';
import fileExtension from './file-extension.js';
import fileSize from './file-size.js';
import fileType from './file-type.js';
import width from './width.js';
import height from './height.js';

export default {
    dimensions,
    ['file-extension']: fileExtension,
    ['file-size']: fileSize,
    ['file-type']: fileType,
    width,
    height,
    /* Add custom, or override existing properties here */
    ...serviceConfigurations.properties?.custom || {}
}