export default function get(asset) {

    return asset.getProperty('tiff:ImageLength') || asset.getProperty('exif:PixelYDimension');

}