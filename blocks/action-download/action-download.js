import services from '../../scripts/asc/core/services/services.js';
import configurations from '../../scripts/asc/configurations.js';
import { escHtml, escAttr } from '../../scripts/asc/html.js';
import { parseActionFragment, wireDialogClose } from '../../scripts/asc.js';

const BINARIES_POLL_INTERVAL = 1000;
const BINARIES_MAX_ATTEMPTS = 10;

function buildTargets(assets, selectedRenditionIds, archiveName) {
  const allDefs = configurations.renditions?.definitions || [];
  const defsById = new Map(allDefs.map((d) => [d.id, d]));
  const targets = [];

  assets.forEach((asset) => {
    const { path: assetPath } = asset;
    if (!assetPath) return;

    if (!selectedRenditionIds.length) {
      targets.push({ parameters: { path: assetPath, archiveName } });
      return;
    }

    const addedKeys = new Set();

    selectedRenditionIds.forEach((id) => {
      const def = defsById.get(id);
      const type = def?.type;

      if (def?.accepts && !def.accepts(asset)) return;

      if (type === 'static' && typeof def.name === 'string') {
        if (def.name === 'original') {
          if (!addedKeys.has('original')) {
            addedKeys.add('original');
            targets.push({
              parameters: { path: assetPath, archiveName, excludeDefaultRenditions: 'true' },
            });
          }
        } else {
          targets.push({
            parameters: { path: `${assetPath}/jcr:content/renditions/${def.name}`, archiveName },
          });
        }
      } else if (type === 'dm-smartcrop') {
        if (!addedKeys.has('smartcrop')) {
          addedKeys.add('smartcrop');
          targets.push({ parameters: { path: assetPath, archiveName, assetTarget: 'smartcrop' } });
        }
      }
    });
  });

  return targets;
}

function openArtifacts(data) {
  (data.artifacts || []).forEach((artifact) => {
    window.open(services.aem.getUrl(artifact.uri), '_blank');
  });
}

async function downloadAsZip(targets) {
  const endpoint = configurations.downloads?.binariesUrl || '/content/dam.downloadbinaries.json';
  const headers = await services.aem.getHeaders();

  const res = await fetch(services.aem.getUrl(endpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    credentials: 'include',
    body: JSON.stringify({ targets }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  let data = await res.json();

  if (!data.isComplete) {
    for (let i = 0; i < BINARIES_MAX_ATTEMPTS; i++) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => { setTimeout(resolve, BINARIES_POLL_INTERVAL); });
      // eslint-disable-next-line no-await-in-loop
      const pollRes = await fetch(
        `${services.aem.getUrl(endpoint)}?downloadId=${data.downloadId}`,
        { credentials: 'include', headers },
      );
      if (!pollRes.ok) throw new Error(`Poll failed: HTTP ${pollRes.status}`);
      // eslint-disable-next-line no-await-in-loop
      data = await pollRes.json();
      if (data.isComplete) break;
    }
    if (!data.isComplete) throw new Error('Download timed out — try again later');
  }

  if (!data.artifacts?.length) throw new Error('No download artifacts in response');
  openArtifacts(data);
}

export default async function decorate(block) {
  const ctx = window.asc?.pendingAction || {};
  const collection = ctx.collectionId ? await services.collections.get(ctx.collectionId) : null;
  const assets = collection?.assets || [];

  const allDefs = configurations.renditions?.definitions || [];
  const defsById = new Map(allDefs.map((d) => [d.id, d]));

  const parsed = parseActionFragment(block, { 'asset-count': assets.length });

  const renditionIds = parsed.renditionIds
    ?? allDefs.filter((d) => d.visible !== false).map((d) => d.id);
  const renditionDefs = renditionIds.map((id) => defsById.get(id) ?? { id, label: id });

  const closeButtons = parsed.actions.filter(({ hash }) => hash === '#close');
  const actionButtons = parsed.actions.filter(({ hash }) => hash !== '#close');

  const dialog = document.createElement('dialog');
  dialog.className = 'asc-dialog asc-dialog--narrow action-download';
  dialog.setAttribute('aria-labelledby', 'action-download-title');
  dialog.innerHTML = `
    <header class="asc-dialog__header">
      <div class="asc-dialog__header-main">
        <h2 class="asc-dialog__title" id="action-download-title">${escHtml(parsed.title || 'Download')}</h2>
      </div>
      <button type="button" class="btn btn--ghost btn--icon asc-dialog__close" aria-label="Close" data-dialog-close>&#x2715;</button>
    </header>
    <div class="asc-dialog__body">
      ${renditionDefs.length ? `
      <fieldset class="action-download__renditions">
        <legend>${escHtml(parsed.renditionLabel || 'Select renditions to download')}</legend>
        ${renditionDefs.map((def) => `
          <label class="action-download__rendition-option">
            <input type="checkbox" name="rendition" value="${escAttr(def.id)}" ${def.id === 'original' ? 'checked' : ''} />
            ${escHtml(def.label || def.id)}
          </label>`).join('')}
      </fieldset>` : ''}
    </div>
    <footer class="asc-dialog__footer">
      ${closeButtons.map(({ label }) => `<button type="button" class="btn btn--secondary" data-dialog-close>${escHtml(label)}</button>`).join('')}
      <div class="asc-dialog__footer-end">
        ${actionButtons.map(({ label, hash }) => `
          <button type="button" class="action-download__submit btn btn--primary" data-action="${escAttr(hash.slice(1))}">${escHtml(label)}</button>
        `).join('')}
      </div>
    </footer>`;

  if (parsed.bodyNodes.length) {
    const headerMain = dialog.querySelector('.asc-dialog__header-main');
    parsed.bodyNodes.forEach((n) => headerMain.appendChild(n));
  }

  document.body.appendChild(dialog);
  dialog.showModal();
  wireDialogClose(dialog);
  dialog.addEventListener('close', () => dialog.remove());

  dialog.querySelectorAll('.action-download__submit').forEach((btn) => {
    const origLabel = btn.textContent.trim();
    btn.addEventListener('click', async () => {
      const resolvedAssets = assets.filter((a) => a.path);
      if (!resolvedAssets.length) {
        alert('Asset paths could not be resolved. Ensure assets have a JCR path.');
        return;
      }

      const checked = [...dialog.querySelectorAll('input[name="rendition"]:checked')];
      const selectedRenditionIds = checked.map((cb) => cb.value);
      if (renditionDefs.length && !selectedRenditionIds.length) {
        alert('Please select at least one rendition.');
        return;
      }

      const archiveName = `${collection?.name || 'collection'}.zip`;
      const targets = buildTargets(resolvedAssets, selectedRenditionIds, archiveName);

      btn.disabled = true;
      btn.textContent = 'Preparing zip…';
      dialog.querySelector('.action-download__error')?.remove();

      try {
        await downloadAsZip(targets);
        btn.textContent = 'Download started ✓';
        setTimeout(() => dialog.close(), 2000);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = origLabel;
        const errEl = Object.assign(document.createElement('p'), {
          className: 'action-download__error',
          textContent: `Download failed: ${err.message}`,
        });
        dialog.querySelector('.asc-dialog__footer').prepend(errEl);
      }
    });
  });
}
