export default function get(asset) {

    const width = asset.getProperty('tiff:ImageWidth') || asset.getProperty('exif:PixelXDimension');
    const height = asset.getProperty('tiff:ImageLength') || asset.getProperty('exif:PixelYDimension');

    return {
        width,
        height
    }
}