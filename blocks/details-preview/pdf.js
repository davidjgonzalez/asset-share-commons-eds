/** @owner user */
import { escAttr } from '../../scripts/html.js';

const VIEWER_JS = 'https://acrobatservices.adobe.com/view-sdk/viewer.js';
const FALLBACK_FRAGMENT = 'view=Fit&zoom=page-fit&toolbar=1&navpanes=0';

export function mount(container, asset, initialRendition, config) {
  const bool = (key, def) => (config[key] === undefined ? def : config[key] !== 'false');
  const cfg = {
    clientId: config['client-id'] || '',
    height: config.height || '600px',
    embedMode: config['embed-mode'] || 'SIZED_CONTAINER',
    defaultViewMode: config['default-view-mode'] || 'FIT_WIDTH',
    showDownload: bool('show-download', true),
    showPrint: bool('show-print', true),
    showBookmarks: bool('show-bookmarks', true),
    showZoomControl: bool('show-zoom-control', true),
    showFullScreen: bool('show-fullscreen', true),
    showAnnotationTools: bool('show-annotation-tools', false),
    readOnly: bool('read-only', false),
    enableLinearization: bool('enable-linearization', false),
  };

  const render = (url, filename) => {
    if (cfg.clientId) {
      renderEmbed(container, url, filename, cfg);
    } else {
      renderIframe(container, url, filename, cfg);
    }
  };

  render(initialRendition?.url || asset.url, initialRendition?.filename || asset.filename || asset.title);

  const setDisplay = (rendition, sticky) => {
    if (!sticky) return; // hover is a no-op for PDF
    render(rendition.url, rendition.filename || asset.filename || asset.title);
  };

  return {
    setDisplay,
    dispose() { container.innerHTML = ''; },
  };
}

function renderEmbed(container, url, filename, cfg) {
  const viewerId = `details-preview-pdf-${crypto.randomUUID()}`;
  container.innerHTML = `
    <div id="${escAttr(viewerId)}" class="details-preview__pdf-embed"
         style="height:${escAttr(cfg.height)}"></div>`;

  const launch = () => {
    const view = new window.AdobeDC.View({ clientId: cfg.clientId, divId: viewerId });
    view.previewFile({
      content: { location: { url } },
      metaData: { fileName: filename, hasReadOnlyAccess: cfg.readOnly },
    }, {
      embedMode: cfg.embedMode,
      defaultViewMode: cfg.defaultViewMode,
      showDownloadPDF: cfg.showDownload,
      showPrintPDF: cfg.showPrint,
      showBookmarks: cfg.showBookmarks,
      showZoomControl: cfg.showZoomControl,
      showFullScreen: cfg.showFullScreen,
      showAnnotationTools: cfg.showAnnotationTools,
      enableFormFilling: cfg.showAnnotationTools,
      enableLinearization: cfg.enableLinearization,
    });
  };

  if (window.AdobeDC) {
    launch();
  } else {
    document.addEventListener('adobe_dc_view_sdk.ready', launch, { once: true });
    if (!document.querySelector(`script[src="${VIEWER_JS}"]`)) {
      const script = document.createElement('script');
      script.src = VIEWER_JS;
      script.async = true;
      document.head.appendChild(script);
    }
  }
}

function buildPdfUrl(url) {
  const [base, existingFrag] = url.split('#', 2);
  const params = new URLSearchParams(existingFrag || '');
  if (!params.has('view')) params.set('view', 'Fit');
  if (!params.has('zoom')) params.set('zoom', 'page-fit');
  if (!params.has('toolbar')) params.set('toolbar', '1');
  if (!params.has('navpanes')) params.set('navpanes', '0');
  return `${base}#${params.toString() || FALLBACK_FRAGMENT}`;
}

function renderIframe(container, url, filename, cfg) {
  container.innerHTML = `
    <iframe
      class="details-preview__frame"
      src="${escAttr(buildPdfUrl(url))}"
      title="${escAttr(filename || 'PDF preview')}"
      style="height:${escAttr(cfg.height)}">
      <a href="${escAttr(url)}" class="btn btn--primary btn--sm"
         target="_blank" rel="noopener">Open PDF</a>
    </iframe>`;
  container.querySelector('iframe').addEventListener('error', () => {
    container.innerHTML = `
      <div class="asc-ui-empty-state">
        <p class="asc-ui-empty-state__title">Could not load PDF</p>
        <p class="asc-ui-empty-state__hint">The asset could not be found or loaded.</p>
      </div>`;
  });
}
