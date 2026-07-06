// ASC Core — do not edit. Customize via scripts/configurations.js
import Rendition from '../../../models/rendition.js';

export default {
  type: 'url',

  fromDefinition(def, asset) {
    if (typeof def.url !== 'function') {
      console.warn(`[ASC] Rendition "${def.id}" has type "url" but url is not a function.`);
      return null;
    }
    const url = def.url(asset);
    if (!url) return null;
    return new Rendition({
      id: def.id,
      label: def.label,
      description: def.description ?? null,
      visible: def.visible ?? true,
      mimeType: def.mimeType ?? null,
      url,
    });
  },
};
