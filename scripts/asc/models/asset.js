export default class Asset {

    constructor(asset) {
        this.asset = asset;
    }

    getPath() {
        return this.asset.path;
    }

    getTitle() {
        return this.asset.title;
    }

    getDescription() {
        return this.asset.description;
    }

    getThumbnail() {
        return this.asset.thumbnail;
    }

    getUrl() {
        return this.asset.url;
    }

    getMimeType() {
        return this.asset.mimeType;
    }

    getRenditions() {
        return this.asset.renditions;
    }
    getExcerpt() {
        return this.asset.excerpt;
    }

    getProperties() {
        return this.asset.properties;
    }
}
