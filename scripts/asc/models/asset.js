import asc from '../../asc.js';

export default class Asset {

    constructor(data) {
        this.aem = asc.aem.host;
        this.data = data;
        this.metadata = data['jcr:content']['metadata'];
    }

    getPath() {
        return this.data['jcr:path'];
    }

    getUuid() {
        return this.data['jcr:uuid'];
    }

    getFilename() {
        return this.data['jcr:content']['cq:name'] || this.getPath()?.split('/')?.pop() || null;
    }

    getSizeInBytes() {
        return this.getProperty('dam:size') || null;
    }

    getCreated() {
        return new Date(this.data['jcr:content']['metadata']['jcr:created']);
    }

    getLastModified() {
        return new Date(this.data['jcr:content']['metadata']['jcr:lastModified']);
    }

    getTitle() {
        return this.data['jcr:content']['metadata']['dc:title'] || this.data['jcr:content']['cq:name'] || 'Missing title';
    }

    getDescription() {
        return this.data['jcr:content']['metadata']['dc:description'];
    }

    getThumbnail() {
        const renditions = this.getRenditions();
        return renditions.find(r => r.name.includes('cq5dam.thumbnail.319.319'));
    }

    getUrl() {
        return `${this.aem}/${this.getPath()}`;
    }

    getMimeType() {
        return this.data['jcr:content']['metadata']['dc:format'];
    }

    getRenditions() {
        const resource = this.data['jcr:content']['renditions'];
        const renditions = [];
        if (resource && typeof resource === 'object') {
            Object.entries(resource).forEach(([key, value]) => {
                if (
                    value &&
                    typeof value === 'object' &&
                    value['jcr:primaryType'] === 'nt:file' &&
                    value['jcr:content'] &&
                    typeof value['jcr:content'] === 'object'
                ) {
                    renditions.push({
                        name: key,
                        path: `${this.getPath()}/jcr:content/renditions/${key}`,
                        url: `${this.aem}${this.getPath()}/_jcr_content/renditions/${key}`,
                        mimeType: value['jcr:content']['jcr:mimeType'] || null,
                        fileSize: value['jcr:content'][':jcr:data'] || null
                    });
                }
            });
        }

        return renditions;
    }
    
    getProperty(property) {
        if (asc.services?.properties?.[property]) {
            return asc.services.properties[property](this);
        }

        return this.metadata[property] || this.data['jcr:content'][property] || this.data[property] || null;
    }

    getData() {
        return this.data;
    }

    getMetadata() {
        return this.data['jcr:content']['metadata'];
    }
}
