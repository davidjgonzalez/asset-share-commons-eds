// ASC Core — do not edit. Customize via scripts/asc/configurations.js
import serviceConfigurations from "../configurations.js";
import dimensions from './dimensions.js';
import fileExtension from './file-extension.js';
import fileSize from './file-size.js';
import fileType from './file-type.js';
import width from './width.js';
import height from './height.js';

// Built-in display properties — usable by name in searchResults.views config
const DISPLAY_PROPERTIES = {
  title:       (asset) => asset.title,
  thumbnail:   (asset) => asset.thumbnail,
  modified:    (asset) => asset.lastModified?.toLocaleDateString() ?? null,
  created:     (asset) => asset.created?.toLocaleDateString() ?? null,
  description: (asset) => asset.description ?? null,
  filename:    (asset) => asset.filename,
  'mime-type': (asset) => asset.mimeType,
};

export default {
    ...DISPLAY_PROPERTIES,
    dimensions,
    ['file-extension']: fileExtension,
    ['file-size']: fileSize,
    ['file-type']: fileType,
    width,
    height,
    /* Add custom, or override existing properties here */
    ...serviceConfigurations.properties?.custom || {}
}
