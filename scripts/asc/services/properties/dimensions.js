import getWidth from './width.js';
import getHeight from './height.js';

export default function get(asset) {

    return {
        width: getWidth(asset),
        height: getHeight(asset)
    }
}