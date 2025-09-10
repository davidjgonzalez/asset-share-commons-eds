import serviceConfigurations from "../configurations.js";

const config = { 
    ...serviceConfigurations.properties?.configs?.['file-type'] || {},
}

const MIME_TYPE_TO_LABEL = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/gif": "GIF",
    "image/webp": "WebP",
    "image/bmp": "BMP",
    "image/tiff": "TIFF",
    "image/x-icon": "ICO",
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
    "text/csv": "CSV",
};

const MEDIA_TYPE_TO_LABEL = {
    "application": "Application",
    "audio": "Audio",
    "font": "Font",
    "example": "Example",
    "image": "Image",
    "message": "Message",
    "model": "3D",
    "multipart": "Multipart document",
    "text": "Text",
    "video": "Video"
};

export default function get(asset, options = { by: 'mime-type'}) {

    const mimeTypeToLabel = {
        ...MIME_TYPE_TO_LABEL, 
        ...config.mimeTypeToLabel || {}
    };

    const mediaTypeToLabel = {
        ...MEDIA_TYPE_TO_LABEL, 
        ...config.mediaTypeToLabel || {}
    };

    // Get the mime type from the asset
    const mimeType = asset.getMimeType();
    if (!mimeType || mimeType.indexOf('/') === -1) {
        return null;
    }

    let value = null;

    if (options.by === 'media-type') {
        const prefix = mimeType.split('/')[0];
        value = mediaTypeToLabel[prefix];    
    } else {
        value = mimeTypeToLabel[mimeType];

        if (!value) {
            const prefix = mimeType.split('/')[0];
            value = mediaTypeToLabel[prefix];
        }    
    }

    return value;
}