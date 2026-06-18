/** @owner user */
/**
 * Shared token resolver for the {{ accessor | fallback }} template syntax.
 *
 * - Accessor resolves via context.getProperty?.(key) then context[key]
 * - Fallback text is used when value is empty/null/undefined
 * - Dangling separators ( · , — , ,) adjacent to empty tokens are trimmed
 */

/** Resolve a single accessor against the context (computed getters first, then getProperty). */
function contextValue(context, accessor) {
  const direct = {
    url: context.url,
    uuid: context.uuid,
    id: context.id,
    filename: context.filename,
    'file-extension': context.fileExtension,
  };
  if (accessor in direct && direct[accessor] != null) return direct[accessor];
  if (typeof context.getProperty === 'function') return context.getProperty(accessor);
  return context[accessor];
}

/** Coerce a context value to a display string, formatting known object shapes. */
function stringifyValue(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    if (value.width != null && value.height != null) return `${value.width} × ${value.height}`;
    return '';
  }
  return String(value).trim();
}

/**
 * Resolves {{ accessor | fallback }} tokens in a template string against a context object.
 * Context can be an Asset instance or any plain key→value map.
 *
 * - Accessor resolves via context.getProperty?.(key) then context[key]
 * - Fallback text is used when value is empty/null/undefined
 * - Dangling separators ( · , — , ,) adjacent to empty tokens are trimmed
 *
 * @param {string} template
 * @param {object} context
 * @returns {string}
 */
export function resolveTokens(template, context) {
  const out = template.replace(/\{\{\s*([^}|]+?)\s*(?:\|\s*([^}]*?)\s*)?\}\}/g, (_, expr, fallback) => {
    const value = stringifyValue(contextValue(context, expr.trim()));
    if (value === '') return fallback != null ? fallback : '';
    return value;
  });

  // Collapse separators around now-empty segments and trim the ends.
  return out
    .replace(/\s*·\s*·\s*/g, ' · ')
    .replace(/^\s*·\s*|\s*·\s*$/g, '')
    .trim();
}

/**
 * Walks all text nodes inside `el` and resolves tokens in-place.
 *
 * @param {Element} el
 * @param {object} context
 */
export function resolveTokensInElement(el, context) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let node = walker.nextNode();
  while (node) {
    nodes.push(node);
    node = walker.nextNode();
  }
  nodes.forEach((textNode) => {
    const resolved = resolveTokens(textNode.nodeValue, context);
    if (resolved !== textNode.nodeValue) {
      // eslint-disable-next-line no-param-reassign
      textNode.nodeValue = resolved;
    }
  });
}

/**
 * Page-level pre-decoration pass. Resolves tokens that can be resolved without
 * a fetched Asset — URL params, page metadata. Leaves asset-specific tokens
 * for blocks to resolve in their own decorate().
 *
 * Called from decorateMain() before decorateBlocks().
 *
 * @param {Element} main
 */
export function resolvePageTokens(main) {
  // Build a shallow context from URL search params and document metadata.
  // Only resolve tokens where the value is available — unknowns stay as-is
  // because resolveTokens leaves unresolvable tokens as empty string /
  // fallback, which is appropriate for page-level pass.
  const params = Object.fromEntries(new URLSearchParams(window.location.search));
  const metaContext = { ...params };
  resolveTokensInElement(main, metaContext);
}
