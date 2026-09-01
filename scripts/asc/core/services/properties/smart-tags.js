// ASC Core — do not edit. Customize via scripts/asc/configurations.js
export default function get(asset) {
  const predictedTags = asset.getProperty('jcr:content/metadata/predictedTags').data;
  if (!predictedTags || typeof predictedTags !== 'object') return null;
  return Object.values(predictedTags)
    .filter((tag) => tag && typeof tag.confidence === 'number')
    .sort((a, b) => b.confidence - a.confidence)
    .map((tag) => tag.name)
    .filter(Boolean) || null;
}
