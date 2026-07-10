/** @owner user */
export default function get(asset) {
  const raw = asset.getProperty('jcr:content/metadata/dc:subject').data;
  if (!raw) return null;
  return Array.isArray(raw) ? raw : [raw];
}
