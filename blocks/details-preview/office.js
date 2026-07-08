/** @owner user */
import { escAttr } from '../../scripts/html.js';

const OFFICE_VIEWER = 'https://view.officeapps.live.com/op/embed.aspx?src=';

export function mount(container, asset, initialRendition, config) {
  const height = config.height || '600px';

  const render = (url, title) => {
    const src = `${OFFICE_VIEWER}${encodeURIComponent(url)}`;
    container.innerHTML = `
      <iframe
        class="details-preview__frame"
        src="${escAttr(src)}"
        title="${escAttr(title || 'Document preview')}"
        style="height:${escAttr(height)}"
        loading="lazy"
        allowfullscreen>
      </iframe>`;
  };

  render(initialRendition?.url || asset.url, initialRendition?.filename || asset.title);

  const setDisplay = (rendition, sticky) => {
    if (!sticky) return; // hover is a no-op for office docs
    render(rendition.url, rendition.filename || asset.title);
  };

  return {
    setDisplay,
    dispose() { container.innerHTML = ''; },
  };
}
