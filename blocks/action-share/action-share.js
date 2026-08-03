import services from '../../scripts/asc/core/services/services.js';
import storage from '../../scripts/asc/core/services/storage/storage.js';
import configurations from '../../scripts/asc/configurations.js';
import { escHtml, escAttr } from '../../scripts/asc/html.js';
import { parseActionFragment, wireDialogClose } from '../../scripts/asc.js';

const SHEET_PATH = configurations.collections?.sheetPath || '/sheets/';
const SHARE_HISTORY_KEY = 'shareHistory';
const MAX_SHARE_HISTORY = 20;

const BOARD_TEXT_KEY = (id) => `asc:boardText:${id}`;
function getBoardTextItems(collectionId) {
  try { return JSON.parse(localStorage.getItem(BOARD_TEXT_KEY(collectionId))) || []; } catch { return []; }
}

function saveShareHistory(entry) {
  const history = storage.get(SHARE_HISTORY_KEY) || [];
  history.unshift({ id: crypto.randomUUID(), ...entry, createdAt: new Date().toISOString() });
  storage.set(SHARE_HISTORY_KEY, history.slice(0, MAX_SHARE_HISTORY));
}

function renderFormField({ id, type, label, placeholder, suffix }, defaultValue = '') {
  const ph = placeholder ? ` placeholder="${escAttr(placeholder)}"` : '';
  const val = defaultValue ? ` value="${escAttr(defaultValue)}"` : '';
  let input;
  if (type === 'textarea') {
    input = `<textarea data-field-id="${escAttr(id)}" rows="3"${ph}></textarea>`;
  } else if (suffix) {
    input = `<div class="action-share__expires-wrap">
        <input type="${escAttr(type)}" data-field-id="${escAttr(id)}"${ph}${val} />
        <span class="action-share__expires-unit">${escHtml(suffix)}</span>
      </div>`;
  } else {
    input = `<input type="${escAttr(type)}" data-field-id="${escAttr(id)}"${ph}${val} />`;
  }
  return `<label class="action-share__label">${escHtml(label)}${input}</label>`;
}

export default async function decorate(block) {
  const ctx = window.asc?.pendingAction || {};
  const collection = ctx.collectionId ? await services.collections.get(ctx.collectionId) : null;

  const parsed = parseActionFragment(block, {});

  const closeButtons = parsed.actions.filter(({ hash }) => hash === '#close');
  const actionButtons = parsed.actions.filter(({ hash }) => hash !== '#close');

  const fields = parsed.fields ?? [
    { id: 'title', type: 'text', label: 'Sheet Title', placeholder: 'Sheet title' },
    { id: 'description', type: 'textarea', label: 'Description', placeholder: 'Optional context or usage guidance for recipients…' },
    { id: 'expires', type: 'number', label: 'Expires in', placeholder: 'No expiry', suffix: 'days' },
  ];

  const dialog = document.createElement('dialog');
  dialog.className = 'asc-dialog asc-dialog--narrow action-share';
  dialog.setAttribute('aria-labelledby', 'action-share-title');
  dialog.innerHTML = `
    <header class="asc-dialog__header">
      <div class="asc-dialog__header-main">
        <h2 class="asc-dialog__title" id="action-share-title">${escHtml(parsed.title || 'Share Collection')}</h2>
      </div>
      <button type="button" class="btn btn--ghost btn--icon asc-dialog__close" aria-label="Close" data-dialog-close>&#x2715;</button>
    </header>
    <div class="asc-dialog__body">
      ${fields.map((f) => renderFormField(f, f.id === 'title' ? (collection?.name || '') : '')).join('')}
      <div class="action-share__url-wrap" hidden>
        <label class="action-share__label">
          Share URL
          <input type="text" data-field-id="share-url" readonly />
        </label>
      </div>
    </div>
    <footer class="asc-dialog__footer">
      ${closeButtons.map(({ label }) => `<button type="button" class="btn btn--secondary" data-dialog-close>${escHtml(label)}</button>`).join('')}
      <div class="asc-dialog__footer-end">
        ${actionButtons.map(({ label, hash }) => `<button type="button" class="action-share__btn btn btn--primary"
              data-action="${escAttr(hash.slice(1))}">${escHtml(label)}</button>`).join('')}
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

  const fieldVal = (id) => dialog.querySelector(`[data-field-id="${id}"]`)?.value?.trim() || '';

  dialog.querySelector('[data-action="action-copy"]')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const title = fieldVal('title');
    const description = fieldVal('description');
    const days = parseInt(fieldVal('expires') || '0', 10);

    const fresh = await services.collections.get(collection?.id);
    const liveItems = (fresh || collection)?.items || [];
    const encodedItems = liveItems.map((item) => {
      if (item.type === 'section') return `~${item.title}|||${item.body}`;
      const pos = (item.x != null && item.y != null)
        ? `@${Math.round(item.x)},${Math.round(item.y)}`
        : '';
      return item.notes ? `${item.id}${pos}|||${item.notes}` : `${item.id}${pos}`;
    });

    const textItems = collection?.id ? getBoardTextItems(collection.id) : [];
    const payload = {
      title: title || collection?.name,
      ...(description && { description }),
      // eslint-disable-next-line no-underscore-dangle
      ...(days > 0 && { expiresAt: new Date(Date.now() + days * 86_400_000).toISOString() }),
      items: encodedItems,
      ...(textItems.length && {
        textElements: textItems.map(({ x, y, w, h, content }) => ({
          x, y, w, h, content,
        })),
      }),
    };

    const compressed = await services.url.compressArray([JSON.stringify(payload)]);
    const url = `${window.location.origin}${SHEET_PATH}?sheet=${compressed}`;

    saveShareHistory({ title: payload.title, url, collectionId: collection?.id });

    // Notify the collection block (or any listener) so it can update its past-shares panel
    document.dispatchEvent(new CustomEvent('asc:share:created', {
      detail: { url, title: payload.title, collectionId: collection?.id },
    }));

    const wrap = dialog.querySelector('.action-share__url-wrap');
    wrap.removeAttribute('hidden');
    wrap.querySelector('[data-field-id="share-url"]').value = url;

    navigator.clipboard.writeText(url).then(() => {
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = orig; }, 2000);
    });
  });
}
