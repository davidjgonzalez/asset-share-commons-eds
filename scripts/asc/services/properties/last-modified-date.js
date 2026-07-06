/** @owner user */
export default function get(asset) {
  const raw = asset.getProperty('jcr:lastModified').data;
  if (!raw) return null;
  return new Date(raw).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}
