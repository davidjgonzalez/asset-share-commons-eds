// ASC Core — do not edit. Customize via scripts/configurations.js
import Rendition from '../../../models/rendition.js';

export default {
  type: 'static',
  autoDetect: false,

  fromDefinition(def, asset) {
    const nodes = asset.staticRenditions;
    const nameValue = typeof def.name === 'function' ? def.name(asset) : def.name;
    const match = nameValue instanceof RegExp
      ? nodes.find((r) => nameValue.test(r.id))
      : nodes.find((r) => r.id === nameValue);
    if (!match) return null;
    return new Rendition({
      id: def.id,
      label: def.label,
      description: def.description ?? `Static rendition (${match.id})`,
      visible: def.visible ?? true,
      mimeType: match.mimeType ?? def.mimeType ?? null,
      fileSize: match.fileSize ?? null,
      width: match.width ?? null,
      height: match.height ?? null,
      url: match.url,
      path: match.path,
    });
  },

  acceptsNode(name, node) {
    return node['jcr:primaryType'] === 'nt:file' && !!node['jcr:content'];
  },

  fromNode(name, _node, asset) {
    return asset.staticRenditions.find((r) => r.id === name) ?? null;
  },
};
