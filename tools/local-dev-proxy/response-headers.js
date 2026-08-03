const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailers', 'transfer-encoding', 'upgrade',
]);

export { HOP_BY_HOP };

export function pathMatches(pathname, pattern) {
  if (!pattern) return true;
  return pathname === pattern || pathname.startsWith(`${pattern}/`) || pathname.startsWith(`${pattern}?`);
}

function normalizeHeaderValue(value) {
  if (Array.isArray(value)) return value.join(', ');
  return value ?? '';
}

function escapeHtmlAttr(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;');
}

function escapeRegex(text) {
  return text.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function patternToRegex(pattern) {
  return new RegExp(`^${escapeRegex(pattern).replaceAll('*', '.*')}$`, 'i');
}

export function contentTypeMatches(headerValue, matcher) {
  if (!matcher) return true;

  const raw = normalizeHeaderValue(headerValue).toLowerCase();
  const mimeType = raw.split(';', 1)[0].trim();

  if (!raw) return false;

  if (matcher instanceof RegExp) {
    return matcher.test(raw) || matcher.test(mimeType);
  }

  const pattern = String(matcher).trim().toLowerCase();
  if (!pattern || pattern === '*' || pattern === '*/*') return true;

  if (pattern.includes('*')) {
    return patternToRegex(pattern).test(mimeType);
  }

  return raw.includes(pattern) || mimeType === pattern;
}

export function transformResponseHeaders(incoming, pathname, { cors = false, headerOverrides = [], targetOrigin = '', proxyOrigin = '' } = {}) {
  const out = Object.fromEntries(
    Object.entries(incoming).filter(([key]) => !HOP_BY_HOP.has(key)),
  );

  // Rewrite redirect Location headers so the browser stays on the proxy
  if (out.location && targetOrigin && proxyOrigin && out.location.startsWith(targetOrigin)) {
    out.location = proxyOrigin + out.location.slice(targetOrigin.length);
  }

  if (cors) {
    out['access-control-allow-origin'] = '*';
    out['access-control-allow-methods'] = 'GET, HEAD, POST, PUT, DELETE, OPTIONS';
    out['access-control-allow-headers'] = '*';
    out['access-control-expose-headers'] = '*';
    delete out['access-control-allow-credentials'];
  }

  for (let i = 0; i < headerOverrides.length; i++) {
    const { pathMatch, contentType, set } = headerOverrides[i];
    const pathOk = pathMatches(pathname, pathMatch);
    const ctOk = contentTypeMatches(out['content-type'], contentType);
    if (pathOk && ctOk) {
      const conditions = [pathMatch || '(all)', contentType ? `type:${contentType}` : null].filter(Boolean).join(' ');
      const headers = Object.entries(set).map(([k, v]) => `${k}: ${v}`).join('; ');
      console.log(`  [override #${i + 1}] ${pathname}  [${conditions}]  →  ${headers}`);
      for (const [key, value] of Object.entries(set)) {
        out[key.toLowerCase()] = value;
      }
    }
  }

  return out;
}

export function isHtmlResponse(headers) {
  return contentTypeMatches(headers['content-type'], 'text/html');
}

export function rewriteHtmlContentSecurityPolicy(html, csp) {
  if (!csp) return html;

  return html.replace(
    /<meta\b([^>]*?)http-equiv=(['"])Content-Security-Policy\2([^>]*?)content=(['"])(.*?)\4([^>]*?)>/i,
    (_match, beforeHttpEquiv, httpEquivQuote, betweenAttrs, contentQuote, _contentValue, afterContent) => `<meta${beforeHttpEquiv}http-equiv=${httpEquivQuote}Content-Security-Policy${httpEquivQuote}${betweenAttrs}content=${contentQuote}${escapeHtmlAttr(csp)}${contentQuote}${afterContent}>`,
  );
}