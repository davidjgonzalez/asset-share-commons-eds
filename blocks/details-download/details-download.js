import { readBlockConfig } from '../../scripts/aem.js';
import Asset from '../../scripts/asc/models/asset.js';

export default async function decorate(block) {
  const config = {
    label: 'Download',
    ...readBlockConfig(block),
  };

  const asset = await Asset.create(block);
  if (!asset) {
    block.innerHTML = '';
    return;
  }

  // Only show renditions explicitly marked visible (visible !== false)
  const downloadable = asset.renditions.filter((r) => r.visible !== false);

  if (!downloadable.length) {
    block.innerHTML = `<p class="details-download__empty">No downloads available.</p>`;
    return;
  }

  block.innerHTML = `
    <p class="details-download__label">${config.label}</p>
    <ul class="details-download__list">
      ${downloadable.map((rendition) => {
    const meta = [
      rendition.mimeType,
      rendition.width && rendition.height ? `${rendition.width}&times;${rendition.height}` : null,
      rendition.fileSize ? formatBytes(rendition.fileSize) : null,
    ].filter(Boolean).join(' &middot; ');

    return `
        <li class="details-download__item">
          <a class="details-download__link"
             href="${rendition.url}"
             download="${asset.title} - ${rendition.label}">
            <span class="details-download__name">${rendition.label}</span>
            ${meta ? `<span class="details-download__meta">${meta}</span>` : ''}
          </a>
        </li>`;
  }).join('')}
    </ul>`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
