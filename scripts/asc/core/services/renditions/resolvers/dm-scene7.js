// ASC Core — do not edit. Customize via scripts/asc/configurations.js
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
  type: 'dm-scene7',
  autoDetect: true,

  acceptsNode(name, node) {
    return node['sling:resourceType'] === 'dam/rendition/smartcrop' && !!node['jcr:content'];
  },

  /**
   * Explicit definitions never guess a DM crop name — they look one up among the
   * asset's real jcr:content/renditions/* smart-crop nodes, the same nodes
   * fromNode()/autoDetect scans. `def.id` is NOT the DM crop name (that mistake is
   * what this resolver exists to avoid): `def.smartCropId` is the exact,
   * case-sensitive DM-registered crop name to look up (falls back to `def.id`
   * if omitted); the definition's job is only to pick *which* real smart-crop
   * node it customizes label/order/accepts for.
   *
   * The resolved Rendition's `id` is the matched node's real name (`def.id` only
   * overrides it if explicitly set) — so no smart-crop definition needs an `id`
   * at all unless you want a stable slug for getRendition() lookups.
   */
  fromDefinition(def, asset) {
    const nodes = asset.data?.['jcr:content']?.renditions;
    if (!nodes || typeof nodes !== 'object') return null;

    const smartCropId = def.smartCropId ?? def.id;
    const entry = Object.entries(nodes).find(
      ([name, node]) => name === smartCropId && this.acceptsNode(name, node),
    );
    if (!entry) return null;
    const [cropName, node] = entry;

    const url = isUrl(asset, cropName);
    if (!url) return null;
    return new Rendition({
      id: def.id ?? cropName,
      label: def.label ?? `Smart Crop — ${cropName}`,
      description: def.description ?? `Dynamic Media smart crop (${cropName})`,
      visible: def.visible ?? true,
      mimeType: 'image/jpeg',
      width: def.width ?? node['jcr:content'].width ?? null,
      height: def.height ?? node['jcr:content'].height ?? null,
      url,
      filename: smartCropFilename(asset, cropName),
    });
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
