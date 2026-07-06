/** @owner user */
export default function get(asset) {
  return asset.getProperty('jcr:content/metadata/dc:creator').data || null;
}
