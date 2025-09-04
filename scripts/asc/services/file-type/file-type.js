// Copyright 2025 David G.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     https://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import serviceConfigurations from "../configurations.js";

class FileType {
    
    static MIME_TYPE_TO_EXTENSION = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/bmp': 'bmp',
        'image/tiff': 'tiff',
        'image/x-icon': 'ico',
        'image/svg+xml': 'svg',
        'application/pdf': 'pdf',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',  
        'application/vnd.ms-excel': 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
        'application/vnd.ms-powerpoint': 'ppt',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
        'video/mp4': 'mp4',
        'audio/mpeg': 'mp3',
        'audio/wav': 'wav',
        'audio/ogg': 'ogg',
        'audio/flac': 'flac',
        'audio/aac': 'aac',
        'audio/m4a': 'm4a',
        'video/quicktime': 'mov',
        'video/x-ms-wmv': 'wmv',
        'video/x-msvideo': 'avi',
        'video/webm': 'webm',
        'video/x-matroska': 'mkv',
        'video/x-flv': 'flv',
        'application/x-shockwave-flash': 'swf',
        'video/3gpp': '3gp',
        'video/3gpp2': '3g2',
        'application/x-mpegurl': 'm3u8',
        'image/heic': 'heic',
        'image/heif': 'heif',
        'image/avif': 'avif',
        'text/plain': 'txt',
        'text/csv': 'csv',
        'application/json': 'json',
        'application/zip': 'zip',
        'application/vnd.rar': 'rar',
        'application/x-7z-compressed': '7z',
        'image/vnd.adobe.photoshop': 'psd',
        'application/vnd.adobe.illustrator': 'ai',
        'application/vnd.adobe.indesign': 'indd',
        'application/vnd.adobe.indesignml': 'inddml',
        'application/vnd.adobe.indesignx': 'inddx',
        'application/vnd.adobe.aftereffects': 'aep',
        'application/vnd.adobe.premiere': 'prproj',
        'application/xml': 'xml'
    };

    static EXTENSION_TO_MIME_TYPE = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'bmp': 'image/bmp',
        'tiff': 'image/tiff',
        'ico': 'image/x-icon',
        'svg': 'image/svg+xml',
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'mp4': 'video/mp4',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'ogg': 'audio/ogg',
        'flac': 'audio/flac',
        'aac': 'audio/aac',
        'm4a': 'audio/m4a',
        'm4v': 'video/mp4',
        'mov': 'video/quicktime',
        'wmv': 'video/x-ms-wmv',
        'avi': 'video/x-msvideo',
        'webm': 'video/webm',
        'mkv': 'video/x-matroska',
        'flv': 'video/x-flv',
        'swf': 'application/x-shockwave-flash',
        '3gp': 'video/3gpp',
        '3g2': 'video/3gpp2',
        'm3u8': 'application/x-mpegurl',
        'm3u': 'application/x-mpegurl',
        'heic': 'image/heic',
        'heif': 'image/heif',
        'avif': 'image/avif',
        'txt': 'text/plain',
        'csv': 'text/csv',
        'json': 'application/json',
        'zip': 'application/zip',
        'rar': 'application/vnd.rar',
        '7z': 'application/x-7z-compressed',
        'psd': 'image/vnd.adobe.photoshop',
        'ai': 'application/vnd.adobe.illustrator',
        'indd': 'application/vnd.adobe.indesign',
        'inddml': 'application/vnd.adobe.indesignml',
        'inddx': 'application/vnd.adobe.indesignx',
        'aep': 'application/vnd.adobe.aftereffects',
        'prproj': 'application/vnd.adobe.premiere'
    };

    constructor(config) {
        this.config = config || {};
        this.mimeTypeToExtension = { ...FileType.MIME_TYPE_TO_EXTENSION, ...(config?.mimeTypeToExtension || {}) };
        this.extensionToMimeType = { ...FileType.EXTENSION_TO_MIME_TYPE, ...(config?.extensionToMimeType || {}) };
    }

    static _extractExtension(filename) {
        if (!filename) return '';
        const match = filename.match(/\.([^.]+)$/);
        return match ? match[1].toLowerCase() : '';
    }

    static _lookupMimeType(extension) {
        const map = { ...FileType.EXTENSION_TO_MIME_TYPE, ...this.mimeTypeToExtension };
        return map[extension?.toLowerCase()] || '';
    }

    static _lookupExtension(mimetype) {
        const map = { ...FileType.MIME_TYPE_TO_EXTENSION, ...this.extensionToMimeType };
        return map[mimetype?.toLowerCase()] || '';
    }

    getExtension(filenameOrMimetype) {
        if (!filenameOrMimetype.includes('/') && filenameOrMimetype.includes('.')) {
            return filenameOrMimetype.split('.').pop();
        } else if (filenameOrMimetype.includes('/')) {
            return FileType._lookupExtension(filenameOrMimetype);
        } else {
            return '';
        }
    }

    getMimeType(filenameOrExtension) {
        let extension = filenameOrExtension;
        if (filenameOrExtension.includes('.')) {
            extension = filenameOrExtension.split('.').pop();
        }

        const mimeType =  FileType._lookupMimeType(extension);
        return mimeType;
    }
}

export default new FileType(serviceConfigurations.fileType);
