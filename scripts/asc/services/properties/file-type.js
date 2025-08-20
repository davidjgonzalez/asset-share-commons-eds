export default function get(asset) {

    // Full mime type to label map
    const mimeTypeToLabels = {
        "image/vnd.adobe.photoshop": "Photoshop",
        "application/msword": "Word Doc",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word Doc",
        "application/vnd.ms-excel": "Excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
        "application/vnd.ms-powerpoint": "PowerPoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
        "application/pdf": "PDF",
        "application/xml": "XML",
        "application/zip": "Zip",
        "application/json": "JSON",
        "application/vnd.adobe.illustrator": "Illustrator",
        "application/vnd.adobe.indesign": "InDesign",
        "application/vnd.adobe.indesignml": "InDesign",
        "application/vnd.adobe.indesignx": "InDesign",
        "application/vnd.adobe.aftereffects": "After Effects",
        "application/vnd.adobe.premiere": "Premiere",
        "application/vnd.adobe.xd": "XD",
        "text/html": "HTML",
        "text/csv": "CSV"
    };

    // Fallback mime type prefix to label map
    const mimeTypePrefixToLabels = {
        "image": "Image",
        "video": "Video",
        "audio": "Audio",
        "font": "Font",
        "model": "3D",
        "text": "Text"
    };

    // Get the mime type from the asset
    const mimeType = asset.getMimeType();

    let value = mimeTypeToLabels[mimeType];

    if (!value) {
        const prefix = mimeType.split('/')[0];
        value = mimeTypePrefixToLabels[prefix];
    }

    return value;
}