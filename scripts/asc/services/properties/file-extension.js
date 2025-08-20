export default function get(asset) {
    return asset.getFilename().split('.').pop() || null;
}