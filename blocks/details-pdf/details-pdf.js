/** @owner user */
/**
 * details-pdf — embeds a PDF rendition using the Adobe PDF Embed API.
 *
 * Requires a free API key from:
 *   https://acrobatservices.adobe.com/dc-integration-creation-app-cdn/main.html
 *
 * Without a client-id the block falls back to a native <iframe>, which works
 * in all modern browsers but lacks the full toolbar, annotation, and view-mode
 * controls of the Embed API.
 *
 * AEM OSGi prerequisite — both viewer modes embed the PDF via <iframe>, so
 * AEM must not send X-Frame-Options: SAMEORIGIN on rendition responses.
 * Remove it from the Sling main servlet additional response headers:
 *
 *   PID:      org.apache.sling.engine.impl.SlingMainServlet
 *   Property: sling.additional.response.headers
 *   Action:   remove the entry "X-Frame-Options=SAMEORIGIN"
 *
 * Authoring (da.live table — all rows optional):
 *
 *   | details-pdf           |                 |
 *   | client-id             | <your-key>      |  ← Adobe PDF Embed API key (enables full viewer); omit for native <iframe>
 *   | height                | 600px           |  ← viewer height, any CSS length (default: 600px)
 *   | embed-mode            | SIZED_CONTAINER |  ← SIZED_CONTAINER | FULL_WIDTH | IN_LINE
 *   | default-view-mode     | FIT_WIDTH       |  ← FIT_PAGE | FIT_WIDTH | TWO_COLUMN | TWO_COLUMN_FIT_PAGE
 *   | show-download         | true            |
 *   | show-print            | true            |
 *   | show-bookmarks        | true            |
 *   | show-zoom-control     | true            |
 *   | show-fullscreen       | true            |
 *   | show-annotation-tools | false           |
 *   | read-only             | false           |
 *   | enable-linearization  | false           |
 */

import { readBlockConfig } from '../../scripts/asc/utils/blocks.js';
import { escHtml, escAttr } from '../../scripts/html.js';
import Asset from '../../scripts/asc/models/asset.js';

const VIEWER_JS = 'https://acrobatservices.adobe.com/view-sdk/viewer.js';

const DEFAULTS = {
  height: '600px',
  embedMode: 'SIZED_CONTAINER',
  defaultViewMode: 'FIT_WIDTH',
};

export default async function decorate(block) {
  const raw = readBlockConfig(block);

  const bool = (key, def) => (raw[key] === undefined ? def : raw[key] !== 'false');

  const config = {
    clientId:           raw['client-id']             || '',
    height:             raw.height                   || DEFAULTS.height,
    embedMode:          raw['embed-mode']            || DEFAULTS.embedMode,
    defaultViewMode:    raw['default-view-mode']     || DEFAULTS.defaultViewMode,
    showDownload:       bool('show-download',         true),
    showPrint:          bool('show-print',            true),
    showBookmarks:      bool('show-bookmarks',        true),
    showZoomControl:    bool('show-zoom-control',     true),
    showFullScreen:     bool('show-fullscreen',       true),
    showAnnotationTools: bool('show-annotation-tools', false),
    readOnly:           bool('read-only',             false),
    enableLinearization: bool('enable-linearization', false),
  };

  const viewerId = `details-pdf-viewer-${crypto.randomUUID()}`;

  block.innerHTML = `<div class="details-pdf__viewer details-pdf__viewer--loading">
    <span class="asc-ui-skeleton" style="width:100%;height:${escAttr(config.height)}"></span>
  </div>`;

  try {
    const asset = await Asset.create(block);
    const url = asset.url;

    if (config.clientId) {
      block.innerHTML = embedHtml(viewerId, config);
      initEmbedApi(viewerId, url, asset, config);
    } else {
      block.innerHTML = iframeHtml(asset, url, config);
    }
  } catch {
    block.innerHTML = errorHtml();
  }
}

// ─── Adobe PDF Embed API ────────────────────────────────────────────────────

function embedHtml(viewerId, config) {
  return `
    <div class="details-pdf__viewer">
      <div id="${escAttr(viewerId)}" class="details-pdf__embed"
           style="height:${escAttr(config.height)}"></div>
    </div>`;
}

function initEmbedApi(viewerId, url, asset, config) {
  const launch = () => {
    const view = new window.AdobeDC.View({ clientId: config.clientId, divId: viewerId });
    view.previewFile({
      content:  { location: { url } },
      metaData: {
        fileName: asset.filename || asset.title,
        hasReadOnlyAccess: config.readOnly,
      },
    }, {
      embedMode:           config.embedMode,
      defaultViewMode:     config.defaultViewMode,
      showDownloadPDF:     config.showDownload,
      showPrintPDF:        config.showPrint,
      showBookmarks:       config.showBookmarks,
      showZoomControl:     config.showZoomControl,
      showFullScreen:      config.showFullScreen,
      showAnnotationTools: config.showAnnotationTools,
      enableFormFilling:   config.showAnnotationTools,
      enableLinearization: config.enableLinearization,
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

// ─── Native <iframe> fallback (no client-id) ─────────────────────────────────

function iframeHtml(asset, url, config) {
  const src = `${url}#toolbar=1&navpanes=1`;
  return `
    <div class="details-pdf__viewer">
      <iframe
        class="details-pdf__frame"
        src="${escAttr(src)}"
        title="${escAttr(asset.title)}"
        style="height:${escAttr(config.height)}"
        loading="lazy">
        <p class="details-pdf__no-iframe">
          <a href="${escAttr(url)}" class="btn btn--primary btn--sm"
             target="_blank" rel="noopener">Open PDF</a>
        </p>
      </iframe>
    </div>
    <div class="details-pdf__actions">
      <a class="btn btn--ghost btn--sm" href="${escAttr(url)}"
         download="${escAttr(asset.filename || asset.title)}"
         rel="noopener">Download ${escHtml(asset.title)}</a>
    </div>`;
}

// ─── Error / empty states ────────────────────────────────────────────────────

function errorHtml() {
  return `
    <div class="asc-ui-empty-state">
      <p class="asc-ui-empty-state__title">Could not load PDF</p>
      <p class="asc-ui-empty-state__hint">The asset could not be found or loaded.</p>
    </div>`;
}
