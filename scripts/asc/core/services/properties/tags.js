/** @owner user */
export default function get(asset) {
  const raw = asset.getProperty('jcr:content/metadata/cq:tags').data;
  const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  return list.map((t) => String(t).split('/').pop()).filter(Boolean);
}
