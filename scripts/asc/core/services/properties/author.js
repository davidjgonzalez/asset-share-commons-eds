// ASC Core — do not edit. Customize via scripts/asc/configurations.js
export default function get(asset) {
  return asset.getProperty('jcr:content/metadata/dc:creator').data || null;
}
