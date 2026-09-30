// ASC Core — do not edit. Customize via scripts/asc/configurations.js
import serviceConfigurations from "../configurations.js";
import dimensions from './dimensions.js';
import fileExtension from './file-extension.js';
import fileSize from './file-size.js';
import fileType from './file-type.js';
import width from './width.js';
import height from './height.js';
import author from './author.js';
import colors from './colors.js';
import history from './history.js';
import keywords from './keywords.js';
import lastModifiedBy from './last-modified-by.js';
import lastModifiedDate from './last-modified-date.js';
import smartTags from './smart-tags.js';
import tags from './tags.js';
import uploadedBy from './uploaded-by.js';
import uploadedDate from './uploaded-date.js';

// Built-in display properties — usable by name in searchResults.views config
const DISPLAY_PROPERTIES = {
  title:       (asset) => asset.title,
  thumbnail:   (asset) => asset.displayUrl,
  // lastModified/created are always Date instances (missing metadata yields an invalid
  // one), so check validity or they'd render "Invalid Date" instead of falling back.
  modified:    (asset) => (Number.isNaN(asset.lastModified?.getTime()) ? null : asset.lastModified.toLocaleDateString()),
  created:     (asset) => (Number.isNaN(asset.created?.getTime()) ? null : asset.created.toLocaleDateString()),
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
    author,
    colors,
    history,
    keywords,
    tags,
    ['last-modified-by']: lastModifiedBy,
    ['last-modified-date']: lastModifiedDate,
    ['smart-tags']: smartTags,
    ['uploaded-by']: uploadedBy,
    ['uploaded-date']: uploadedDate,
    /* Add custom, or override existing properties here */
    ...serviceConfigurations.properties?.custom || {}
}
