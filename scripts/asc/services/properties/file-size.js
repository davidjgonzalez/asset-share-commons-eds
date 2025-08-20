export default function get(asset) {
    const bytes = asset.getProperty('jcr:content/metadata/dam:size');

    if (bytes) {
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    return null;
}