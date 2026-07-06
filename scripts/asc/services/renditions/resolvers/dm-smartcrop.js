// ASC Core — do not edit. Customize via scripts/configurations.js
import Rendition from '../../../models/rendition.js';

function isUrl(asset, cropName) {
  const rawDomain = asset.getProperty('dam:scene7Domain').data;
  const dmFile = asset.getProperty('dam:scene7File').data;
  if (!rawDomain || !dmFile) return null;
  const domain = rawDomain.endsWith('/') ? rawDomain : `${rawDomain}/`;
  return `${domain}is/image/${dmFile}:${cropName}`;
}

function smartCropFilename(asset, cropName) {
  const stem = (asset.filename?.replace(/\.[^.]+$/, '')) ?? asset.title ?? 'download';
  return `${stem}-smart-crop-${cropName}.jpg`;
}

export default {
  type: 'dm-smartcrop',
  autoDetect: true,

  fromDefinition(def, asset) {
    const url = isUrl(asset, def.id);
    if (!url) return null;
    return new Rendition({
      id: def.id,
      label: def.label,
      description: def.description ?? null,
      visible: def.visible ?? true,
      mimeType: 'image/jpeg',
      width: def.width ?? null,
      height: def.height ?? null,
      url,
      filename: smartCropFilename(asset, def.id),
    });
  },

  acceptsNode(name, node) {
    return node['sling:resourceType'] === 'dam/rendition/smartcrop' && !!node['jcr:content'];
  },

  fromNode(name, node, asset) {
    const url = isUrl(asset, name);
    if (!url) return null;
    return new Rendition({
      id: name,
      label: `Smart Crop — ${name}`,
      description: `Dynamic Media smart crop (${name})`,
      visible: true,
      mimeType: 'image/jpeg',
      width: node['jcr:content'].width ?? null,
      height: node['jcr:content'].height ?? null,
      url,
      filename: smartCropFilename(asset, name),
    });
  },
};
