// ASC Core — do not edit. Customize via scripts/asc/configurations.js
//
// Re-exports the user-owned configuration so ASC core services can import it from a
// stable relative path. It is ALSO the single place where an optional, author-editable
// settings sheet is overlaid onto that config.
//
// Precedence: code (configurations.js) < settings sheet < URL param.
//
// Opt-in: nothing is fetched unless `settings.sheet` is set in configurations.js, so the
// default path has zero network overhead. Because every core service imports this module,
// its top-level await completes the overlay before any service constructs — so a sheet
// value takes effect even for services that read config once at construction time.
// The fetched values are cached in sessionStorage, so only the first page view per session
// pays the round trip (and the theme is then available synchronously on later views).

import userConfig from '../../configurations.js';

// Only these keys may come from the sheet — a mis-entered or hostile row can't reach
// behavioural config (functions, module swaps, hosts). Value = coercion for the string cell.
const bool = (v) => String(v).trim().toLowerCase() === 'true';
const int = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : undefined; };
const str = (v) => String(v).trim();

const WHITELIST = {
  'theme.default': str,
  'search.pageSize': int,
  'search.page': str,
  'seo.enabled': bool,
  'seo.siteName': str,
  'seo.defaultImage': str,
  'seo.canonicalBase': str,
  'analytics.enabled': bool,
  'notifications.enabled': bool,
  'notifications.location': str,
  'notifications.duration': int,
  'activity.enabled': bool,
  'activity.max': int,
  'webmcp.enabled': bool,
  'init.preload': bool,
  'debug.debug': bool,
};

// URL params that override a whitelisted key for a single visit (deep-link / preview).
const URL_OVERRIDES = {
  theme: 'theme.default',
  pageSize: 'search.pageSize',
};

const FETCH_TIMEOUT_MS = 1500;

function deepSet(obj, path, value) {
  if (value === undefined) return;
  const keys = path.split('.');
  let node = obj;
  for (let i = 0; i < keys.length - 1; i += 1) {
    if (typeof node[keys[i]] !== 'object' || node[keys[i]] === null) node[keys[i]] = {};
    node = node[keys[i]];
  }
  node[keys[keys.length - 1]] = value;
}

/** Turn sheet `{ key, value }` rows into a { path: coercedValue } overrides object. */
function buildOverrides(rows) {
  const overrides = {};
  rows.forEach(({ key, value }) => {
    const path = (key || '').trim();
    const coerce = WHITELIST[path];
    if (!coerce || value == null || value === '') return;
    const coerced = coerce(value);
    if (coerced !== undefined) overrides[path] = coerced;
  });
  return overrides;
}

async function fetchOverrides(sheet, sheetName, cacheKey) {
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch { /* sessionStorage unavailable — fall through to fetch */ }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const resp = await fetch(`${sheet}.json?sheet=${encodeURIComponent(sheetName)}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) return {};
    const { data = [] } = await resp.json();
    const overrides = buildOverrides(data);
    try { sessionStorage.setItem(cacheKey, JSON.stringify(overrides)); } catch { /* ignore quota/private mode */ }
    return overrides;
  } catch {
    // Missing/slow/malformed sheet — degrade silently to code defaults.
    return {};
  }
}

function applyUrlOverrides(config) {
  let params;
  try { params = new URLSearchParams(window.location.search); } catch { return; }
  Object.entries(URL_OVERRIDES).forEach(([param, path]) => {
    const raw = params.get(param);
    if (raw == null || raw === '') return;
    const coerce = WHITELIST[path];
    if (coerce) deepSet(config, path, coerce(raw));
  });
}

const sheet = userConfig.settings?.sheet;
if (sheet) {
  const sheetName = userConfig.settings.sheetName || 'settings';
  const overrides = await fetchOverrides(sheet, sheetName, `asc:settings:${sheet}:${sheetName}`);
  Object.entries(overrides).forEach(([path, value]) => deepSet(userConfig, path, value));
}
applyUrlOverrides(userConfig);

export default userConfig;
