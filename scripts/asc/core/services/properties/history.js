// ASC Core — do not edit. Customize via scripts/asc/configurations.js
import { propValue } from '../../../html.js';
import { escHtml } from '../../../html.js';

const PATH = 'jcr:content/metadata/xmpMM:History';

/**
 * Renders the XMP editing history for an asset.
 * Each entry shows the action (chip), formatted timestamp, and software agent.
 *
 * AEM stores xmpMM:History as either:
 *   - An array of entry objects   (flat JSON API)
 *   - A JCR node object whose values are entry objects (keys like "xmpMM:History[1]")
 * Both forms are handled; entries without stEvt:action or stEvt:when are skipped.
 */
export default function get(asset) {
  const raw = asset.getProperty(PATH).data;
  const entries = normalizeHistory(raw);
  if (!entries.length) return null;

  const rows = entries.map(({ action, when, agent }) => {
    const date = when ? formatDate(when) : '';
    // divs are block-level by default → two-line layout requires no CSS.
    // CSS adds gap, border, and colour; layout works without it.
    return `<div class="asc-history-entry">`
      + `<div class="asc-history-entry__top">`
      + (action ? `<span class="asc-ui-chip asc-history-entry__action">${escHtml(action)}</span> ` : '')
      + (date   ? `<small class="asc-history-entry__when">${escHtml(date)}</small>` : '')
      + `</div>`
      + (agent  ? `<small class="asc-history-entry__agent">${escHtml(agent)}</small>` : '')
      + `</div>`;
  });

  const html = `<div class="asc-history-list">${rows.join('')}</div>`;
  const text = entries.map((e) => [e.action, e.when, e.agent].filter(Boolean).join(' · ')).join('\n');
  return propValue(entries, html, text);
}

function normalizeHistory(raw) {
  if (!raw) return [];
  const candidates = Array.isArray(raw) ? raw : Object.values(raw);
  return candidates.filter(isEntry).map(toEntry);
}

function isEntry(v) {
  return v && typeof v === 'object' && ('stEvt:action' in v || 'stEvt:when' in v);
}

function toEntry(v) {
  return {
    action: v['stEvt:action'] || '',
    when:   v['stEvt:when']   || '',
    agent:  v['stEvt:softwareAgent'] || '',
  };
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
