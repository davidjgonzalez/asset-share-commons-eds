// ASC Core — do not edit. Customize via scripts/asc/configurations.js
import Rendition from '../../../models/rendition.js';

export default {
  type: 'dm-openapi',

  fromDefinition(def, asset, aemConfig) {
    const deliveryHost = aemConfig?.deliveryHost || aemConfig?.host;
    if (!deliveryHost) {
      console.warn('[ASC] Rendition type "dm-openapi" requires aem.host or aem.deliveryHost in configurations.js');
      return null;
    }
    if (!asset.uuid) return null;

    const ext = def.format || asset.fileExtension || 'jpg';
    const fullname = asset.path?.split('/').pop() ?? 'asset';
    const stem = fullname.includes('.') ? fullname.slice(0, fullname.lastIndexOf('.')) : fullname;
    const params = def.params ? `?${def.params}` : '';

    return new Rendition({
      id: def.id,
      label: def.label,
      description: def.description ?? null,
      visible: def.visible ?? true,
      mimeType: def.mimeType ?? null,
      size: def.size ?? null,
      url: `${deliveryHost}/adobe/dynamicmedia/deliver/${asset.uuid}/${stem}.${ext}${params}`,
    });
  },
};
