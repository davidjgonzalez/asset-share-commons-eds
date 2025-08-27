export default function get(asset) {

   return asset.getProperty('tiff:ImageWidth') || asset.getProperty('exif:PixelXDimension');

}