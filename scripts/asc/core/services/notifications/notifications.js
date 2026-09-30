// ASC Core — do not edit. Customize via scripts/asc/configurations.js
/**
 * Notifications service — toast feedback for actions that have a real, visible
 * effect on the system (a download finished, a collection was created/deleted,
 * a share link was generated). Auto-initializes on import, like every other
 * core service — no explicit init call needed.
 *
 * Two ways to trigger a toast:
 *   1. Call services.notifications.notify(message, options) directly.
 *   2. Dispatch `asc:notification:show` on `document` with detail
 *      { message, type?, duration? } — the event-bus escape hatch, for code
 *      that doesn't want to import this service directly. See AGENTS.md's
 *      event table.
 *
 * Which built-in ASC events auto-trigger a toast (and their default wording)
 * is the LISTENERS array below. Add your own without editing this file via
 * configurations.js → notifications.customListeners: an array of
 * [eventName, handler] tuples, same shape as LISTENERS, merged in at init
 * time. Override built-in wording (or suppress a toast entirely) via
 * configurations.js → notifications.enrich instead of editing LISTENERS.
 *
 * Cross-cutting knobs (location, duration, enabled, message overrides) live
 * in configurations.js → notifications.
 */
import serviceConfigurations from '../configurations.js';
import { icon } from '../../utils/icons.js';

const LOCATIONS = ['top-left', 'top-right', 'top-center', 'bottom-left', 'bottom-right', 'bottom-center'];
const DEFAULT_DURATION = 4000;

const ICONS = {
  success: icon('check', { size: 18, strokeWidth: 2.5 }),
  danger: icon('warning', { size: 18, strokeWidth: 2.5 }),
  warning: icon('warning', { size: 18, strokeWidth: 2.5 }),
  info: icon('info', { size: 18, strokeWidth: 2.5 }),
  close: icon('close', { size: 14, strokeWidth: 2.5 }),
};

class Notifications {
  constructor(config) {
    this.config = config || {};
    this.region = null;
    document.addEventListener('asc:notification:show', (e) => {
      const { message, type, duration } = e.detail || {};
      this.notify(message, { type, duration });
    });
    this.attachListeners();
  }

  getRegion() {
    if (this.region) return this.region;
    const location = LOCATIONS.includes(this.config.location) ? this.config.location : 'bottom-right';
    this.region = document.createElement('div');
    this.region.className = `asc-ui-toast-region asc-ui-toast-region--${location}`;
    this.region.setAttribute('role', 'status');
    this.region.setAttribute('aria-live', 'polite');
    // Every modal in this app is a native <dialog> opened via showModal(),
    // which promotes it into the browser's top layer — a z-index, no matter
    // how high (see --z-toast in styles.css), can never out-rank that. Promote
    // this region into the top layer too (same mechanism <dialog> uses) so a
    // toast fired while a dialog is open still renders above it. `manual` (not
    // `auto`) so outside clicks/Escape don't dismiss it like a real popover.
    if (typeof this.region.showPopover === 'function') {
      this.region.setAttribute('popover', 'manual');
    }
    document.body.appendChild(this.region);
    return this.region;
  }

  // Bump the region back to the top of the top-layer stack for every toast —
  // top-layer order is insertion order, so a dialog opened *after* the region
  // was first shown would otherwise still end up above it.
  showRegion(region) {
    if (!region.hasAttribute('popover')) return;
    if (region.matches(':popover-open')) region.hidePopover();
    region.showPopover();
  }

  /**
   * Show a toast.
   * @param {string} message
   * @param {object} [options]
   * @param {'success'|'warning'|'danger'} [options.type]  Omit for the neutral/info style.
   * @param {number} [options.duration]  ms before auto-dismiss; 0 = stays until closed.
   *   Defaults to configurations.notifications.duration, then 4000.
   */
  notify(message, { type, duration } = {}) {
    if (this.config.enabled === false || !message) return;
    const resolved = this.config.enrich ? this.config.enrich(message, { type }) : message;
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

    const region = this.getRegion();
    region.appendChild(el);
    this.showRegion(region);

    const ms = duration ?? this.config.duration ?? DEFAULT_DURATION;
    if (ms > 0) setTimeout(close, ms);
  }

  // Deliberately NOT wiring asc:collection:add/remove — favoriting fires on
  // every click during normal browsing and already has inline feedback (the
  // toggle button itself filling in); add it via customListeners if you want
  // a toast anyway.
  builtInListeners() {
    return [
      ['asc:download:complete', () => this.notify('Download ready', { type: 'success' })],
      ['asc:download:failed', () => this.notify('Download failed', { type: 'danger' })],
      ['asc:collection:created', (e) => this.notify(`Collection "${e.detail?.collection?.name || ''}" created`, { type: 'success' })],
      ['asc:collection:deleted', () => this.notify('Collection deleted', { type: 'success' })],
      ['asc:share:created', () => this.notify('Share link created', { type: 'success' })],
    ];
  }

  attachListeners() {
    [...this.builtInListeners(), ...(this.config.customListeners || [])]
      .forEach(([eventName, handler]) => document.addEventListener(eventName, handler));
  }
}

export default new Notifications(serviceConfigurations.notifications || {});
