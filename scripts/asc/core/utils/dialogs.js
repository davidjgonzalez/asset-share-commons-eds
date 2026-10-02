// ASC Core — do not edit. Customize via scripts/asc/configurations.js
/*
 * Themed replacements for window.confirm() / window.prompt(), built from the UI Kit
 * dialog (.asc-dialog) and field (.asc-ui-field) primitives. Both return a promise, so a
 * call site reads the same as the browser function it replaces:
 *
 *   if (!await confirmDialog({ title: 'Delete collection', message: 'This cannot be undone.', destructive: true })) return;
 *   const name = await promptDialog({ title: 'Duplicate collection', label: 'Name', value: 'Copy of X' });
 *   if (!name) return;
 */
import { escHtml, escAttr } from './html.js';

let counter = 0;

function openDialog({ title, body, confirmLabel, cancelLabel, destructive, onConfirm }) {
  counter += 1;
  const titleId = `asc-dialog-title-${counter}`;
  const dialog = document.createElement('dialog');
  dialog.className = 'asc-dialog asc-dialog--narrow';
  dialog.setAttribute('aria-labelledby', titleId);
  dialog.innerHTML = `
    <header class="asc-dialog__header">
      <div class="asc-dialog__header-main">
        <h2 class="asc-dialog__title" id="${titleId}">${escHtml(title)}</h2>
      </div>
      <button type="button" class="btn btn--ghost btn--icon asc-dialog__close" aria-label="Close" data-dialog-close>&#x2715;</button>
    </header>
    <div class="asc-dialog__body">${body}</div>
    <footer class="asc-dialog__footer">
      <button type="button" class="btn btn--secondary" data-dialog-close>${escHtml(cancelLabel)}</button>
      <div class="asc-dialog__footer-end">
        <button type="button" class="btn ${destructive ? 'btn--danger' : 'btn--primary'}" data-dialog-confirm>${escHtml(confirmLabel)}</button>
      </div>
    </footer>`;

  return new Promise((resolve) => {
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'confirm' ? onConfirm(dialog) : null);
      dialog.remove();
    });
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog || e.target.closest('[data-dialog-close]')) dialog.close('cancel');
      if (e.target.closest('[data-dialog-confirm]')) dialog.close('confirm');
    });
    document.body.appendChild(dialog);
    dialog.showModal();
    (dialog.querySelector('input') || dialog.querySelector('[data-dialog-confirm]')).focus();
    dialog.querySelector('input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') dialog.close('confirm');
    });
  });
}

/**
 * Asks the visitor to confirm an action.
 *
 * @param {object} options
 * @param {string} options.title
 * @param {string} [options.message]
 * @param {string} [options.confirmLabel='Confirm']
 * @param {string} [options.cancelLabel='Cancel']
 * @param {boolean} [options.destructive=false]  Styles the confirm button as a danger action
 * @returns {Promise<boolean>} true when confirmed
 */
export async function confirmDialog({
  title, message = '', confirmLabel = 'Confirm', cancelLabel = 'Cancel', destructive = false,
}) {
  const result = await openDialog({
    title,
    body: message ? `<p class="asc-ui-copy">${escHtml(message)}</p>` : '',
    confirmLabel,
    cancelLabel,
    destructive,
    onConfirm: () => true,
  });
  return result === true;
}

/**
 * Asks the visitor for a line of text.
 *
 * @param {object} options
 * @param {string} options.title
 * @param {string} [options.label]  Field label
 * @param {string} [options.value]  Initial value
 * @param {string} [options.placeholder]
 * @param {number} [options.maxLength=80]
 * @param {string} [options.confirmLabel='OK']
 * @param {string} [options.cancelLabel='Cancel']
 * @returns {Promise<string|null>} The trimmed text, or null when cancelled or left empty
 */
export async function promptDialog({
  title, label = '', value = '', placeholder = '', maxLength = 80, confirmLabel = 'OK', cancelLabel = 'Cancel',
}) {
  const result = await openDialog({
    title,
    body: `<label class="asc-ui-field">
      ${label ? `<span class="asc-ui-field__label">${escHtml(label)}</span>` : ''}
      <input type="text" value="${escAttr(value)}" placeholder="${escAttr(placeholder)}" maxlength="${maxLength}" autocomplete="off" />
    </label>`,
    confirmLabel,
    cancelLabel,
    destructive: false,
    onConfirm: (dialog) => dialog.querySelector('input').value.trim(),
  });
  return result || null;
}
