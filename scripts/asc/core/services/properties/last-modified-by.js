/** @owner user */
export default function get(asset) {
  return asset.getProperty('jcr:lastModifiedBy').data || null;
}
