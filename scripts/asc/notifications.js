/** @owner user */
/**
 * notifications — toast feedback for actions that have a real, visible effect on the
 * system (a download finished, a collection was created/deleted, a share link was
 * generated). Self-initializes on import — see scripts/asc.js.
 *
 * Two ways to trigger a toast:
 *   1. Call notify(message, options) directly from any module.
 *   2. Dispatch `asc:notification:show` on `document` with detail
 *      { message, type?, duration? } — the event-bus escape hatch, for code that
 *      doesn't want to import this module directly. See AGENTS.md's event table.
 *
 * Which built-in ASC events auto-trigger a toast (and their wording) is controlled by
 * the LISTENERS array below — this mirrors scripts/asc/analytics.js's own LISTENERS
 * pattern exactly, so customizing "what shows a toast" is just editing a plain array
 * in this user-owned file, not a config-driven mapping layer.
 *
 * Cross-cutting knobs (location, duration, enabled, message overrides) live in
 * configurations.js -> notifications, same shape as the analytics bridge's
 * enabled/enrich options.
 */
import configurations from './configurations.js';

const config = configurations.notifications || {};
const LOCATIONS = ['top-left', 'top-right', 'top-center', 'bottom-left', 'bottom-right', 'bottom-center'];
const DEFAULT_DURATION = 4000;

const ICONS = {
  success: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
  danger: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  warning: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  info: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  close: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
};

let region = null;

function getRegion() {
  if (region) return region;
  const location = LOCATIONS.includes(config.location) ? config.location : 'bottom-right';
  region = document.createElement('div');
  region.className = `asc-ui-toast-region asc-ui-toast-region--${location}`;
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  document.body.appendChild(region);
  return region;
}

/**
 * Show a toast.
 * @param {string} message
 * @param {object} [options]
 * @param {'success'|'warning'|'danger'} [options.type]  Omit for the neutral/info style.
 * @param {number} [options.duration]  ms before auto-dismiss; 0 = stays until closed.
 *   Defaults to configurations.notifications.duration, then 4000.
 */
export function notify(message, { type, duration } = {}) {
  if (config.enabled === false || !message) return;
  const resolved = config.enrich ? config.enrich(message, { type }) : message;
  if (!resolved) return;

  const el = document.createElement('div');
  el.className = `asc-ui-toast${type ? ` asc-ui-toast--${type}` : ''}`;
  el.setAttribute('role', type === 'danger' ? 'alert' : 'status');
  el.dataset.ascMessage = resolved;
  el.innerHTML = `
    <span class="asc-ui-toast__icon" aria-hidden="true">${ICONS[type] || ICONS.info}</span>
    <span class="asc-ui-toast__message"></span>
    <button type="button" class="btn btn--ghost btn--icon btn--sm asc-ui-toast__dismiss" aria-label="Dismiss">${ICONS.close}</button>
  `;
  el.querySelector('.asc-ui-toast__message').textContent = resolved;

  const close = () => {
    el.classList.add('asc-ui-toast--leaving');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  };
  el.querySelector('.asc-ui-toast__dismiss').addEventListener('click', close);

  getRegion().appendChild(el);

  const ms = duration ?? config.duration ?? DEFAULT_DURATION;
  if (ms > 0) setTimeout(close, ms);
}

document.addEventListener('asc:notification:show', (e) => {
  const { message, type, duration } = e.detail || {};
  notify(message, { type, duration });
});

// ── Default event wiring — edit directly to add/remove/reword ──────────────
// Deliberately NOT wiring asc:collection:add/remove — favoriting fires on every
// click during normal browsing and already has inline feedback (the toggle
// button itself filling in); add it here if you want a toast anyway.
const LISTENERS = [
  ['asc:download:complete', () => notify('Download ready', { type: 'success' })],
  ['asc:download:failed', () => notify('Download failed', { type: 'danger' })],
  ['asc:collection:created', (e) => notify(`Collection "${e.detail?.collection?.name || ''}" created`, { type: 'success' })],
  ['asc:collection:deleted', () => notify('Collection deleted', { type: 'success' })],
  ['asc:share:created', () => notify('Share link created', { type: 'success' })],
];
LISTENERS.forEach(([eventName, handler]) => document.addEventListener(eventName, handler));
