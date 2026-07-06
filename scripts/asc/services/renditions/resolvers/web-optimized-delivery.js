// ASC Core — do not edit. Customize via scripts/configurations.js
import Rendition from '../../../models/rendition.js';

export default {
  type: 'web-optimized-delivery',

  fromDefinition(def, asset, aemConfig) {
    const deliveryHost = aemConfig?.deliveryHost || aemConfig?.host;
    if (!deliveryHost) {
      console.warn('[ASC] Rendition type "web-optimized-delivery" requires aem.host or aem.deliveryHost in configurations.js');
      return null;
    }

    const fullname = asset.path?.split('/').pop() ?? 'asset';
    const params = def.params ? `?${def.params}` : '';

    return new Rendition({
      id: def.id,
      label: def.label,
      description: def.description ?? null,
      visible: def.visible ?? true,
      mimeType: def.mimeType ?? null,
      size: def.size ?? null,
      url: `${deliveryHost}/adobe/dynamicmedia/deliver/dm-aid--${asset.uuid}/${fullname}${params}`,
    });
  },
};
