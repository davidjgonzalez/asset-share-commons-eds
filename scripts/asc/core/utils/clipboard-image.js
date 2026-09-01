// ASC Core — do not edit. Customize via scripts/asc/configurations.js
import configurations from '../../configurations.js';

const IMAGE_EXTENSION_RE = /\.(?:avif|gif|jpe?g|png|tiff?|webp)(?:[?#]|$)/i;
const limits = configurations.copyImage || {};

export function canCopyImage(rendition) {
  if (!rendition?.url) return false;
  if (rendition.mimeType) {
    return rendition.mimeType.startsWith('image/')
      && rendition.mimeType !== 'image/svg+xml';
  }
  return IMAGE_EXTENSION_RE.test(rendition.filename || rendition.url);
}

class CopyImageLimitError extends Error {}
/**
 * clipboard-image — copy a rendition's actual image bytes to the OS clipboard,
 * not just its URL, via the Async Clipboard API. Lets someone paste a photo
 * straight into Slack, an email, or a doc without a download-then-attach round trip.
 *
 * Browser support for `ClipboardItem` with image data is real but narrow — reliable
 * only for `image/png` — so any other source format (JPEG, WebP) is re-encoded to
 * PNG via canvas before writing.
 *
 * The most likely real-world failure isn't browser support, it's CORS: writing
 * the image requires `fetch()`-ing its bytes, which needs an
 * Access-Control-Allow-Origin response header from the delivery host. An <img>
 * tag doesn't need that (which is why the image already renders fine on the page
 * even when this fails) — if your AEM/Dynamic Media delivery host doesn't send
 * permissive CORS headers, this silently falls back to copying the URL instead.
 *
 * @param {object|string} renditionOrUrl - rendition metadata or an image URL
 * @returns {Promise<'image'|'text'|'failed'>} what actually ended up on the clipboard
 */
export async function copyImageToClipboard(renditionOrUrl) {
  const rendition = typeof renditionOrUrl === 'string'
    ? { url: renditionOrUrl }
    : renditionOrUrl;
  if (!canCopyImage(rendition)) return 'failed';
  const { url } = rendition;
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    return copyUrlFallback(url);
  }
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(String(res.status));
    const contentType = res.headers.get('content-type') || rendition.mimeType || '';
    if (!contentType.startsWith('image/') || contentType === 'image/svg+xml') return 'failed';
    const contentLength = Number(res.headers.get('content-length'));
    if (limits.maxBytes && contentLength > limits.maxBytes) return 'failed';
    const blob = await res.blob();
    if (limits.maxBytes && blob.size > limits.maxBytes) return 'failed';
    const pngBlob = blob.type === 'image/png' ? blob : await toPngBlob(blob);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
    return 'image';
  } catch (err) {
    if (err instanceof CopyImageLimitError) return 'failed';
    // eslint-disable-next-line no-console
    console.warn('[ASC] copy image to clipboard failed, falling back to URL:', err);
    return copyUrlFallback(url);
  }
}

async function copyUrlFallback(url) {
  try {
    await navigator.clipboard.writeText(url);
    return 'text';
  } catch {
    return 'failed';
  }
}

async function toPngBlob(blob) {
  const bitmap = await createImageBitmap(blob);
  if (limits.maxPixels && bitmap.width * bitmap.height > limits.maxPixels) {
    bitmap.close();
    throw new CopyImageLimitError('image exceeds configured pixel limit');
  }
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas toBlob failed'))), 'image/png');
  });
}
