/** @owner user */
/**
 * Shared token resolver for the {{ accessor | fallback }} template syntax.
 *
 * - Accessor resolves via context.getProperty?.(key) then context[key]
 * - Fallback text is used when value is empty/null/undefined
 * - Dangling separators ( · , — , ,) adjacent to empty tokens are trimmed
 */

/**
 * Resolve a single accessor against the context (computed getters first, then getProperty).
 *
 * Supports namespacing: if `accessor` is `ns.rest` and `context[ns]` is itself an object,
 * resolution continues against that object for `rest` (e.g. `{{asset.title}}` against
 * `{ asset, rendition }`). Plain flat keys that happen to contain a dot (e.g. the page-wide
 * registry's `'collection.title'`) are unaffected, since their value is a string, not an
 * object — the namespace switch only fires when `context[ns]` is itself an object.
 */
function contextValue(context, accessor) {
  const dot = accessor.indexOf('.');
  if (dot !== -1) {
    const ns = context[accessor.slice(0, dot)];
    if (ns != null && typeof ns === 'object') return contextValue(ns, accessor.slice(dot + 1));
  }

  const direct = {
    url: context.url,
    uuid: context.uuid,
    id: context.id,
    filename: context.filename,
    'file-extension': context.fileExtension,
  };
  if (accessor in direct && direct[accessor] != null) return direct[accessor];
  if (typeof context.getProperty === 'function') return context.getProperty(accessor).data;
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
 * Context can be an Asset instance, a namespace map (`{ asset, rendition, ... }`), or any
 * plain key→value map.
 *
 * - `ns.accessor` switches to `context[ns]` when that value is itself an object — lets one
 *   template pull from several related things, e.g. `{{asset.title}} · {{rendition.dimensions}}`
 *   against `{ asset, rendition }`
 * - Otherwise, accessor resolves via context.getProperty?.(key) then context[key]
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
 * Page-wide token registry. Any block can merge values into it via registerTokens()
 * — every {{...}} occurrence recorded anywhere in the document (title, meta content,
 * headings, paragraphs, links — head or body, any section) is re-resolved against the
 * full merged registry each time. An accessor with nothing registered yet just doesn't
 * resolve (empty, or its fallback) until it is — there's no ordering dependency between
 * whichever blocks end up supplying values.
 */
const registry = {};
const recorded = []; // { el, attr: null | 'content', template }

const TEXT_SELECTOR = 'title,h1,h2,h3,h4,h5,h6,p,a';

/** Finds every element in `root` carrying a {{...}} template and records it (once). */
function scan(root) {
  root.querySelectorAll(TEXT_SELECTOR).forEach((el) => {
    if (el.textContent.includes('{{') && !recorded.some((r) => r.el === el && r.attr === null)) {
      recorded.push({ el, attr: null, template: el.textContent });
    }
  });

  root.querySelectorAll('meta[content]').forEach((el) => {
    if (el.content.includes('{{') && !recorded.some((r) => r.el === el && r.attr === 'content')) {
      recorded.push({ el, attr: 'content', template: el.content });
    }
  });
}

/** Re-renders every recorded template against the current registry. */
function resolveAll() {
  recorded.forEach(({ el, attr, template }) => {
    const resolved = resolveTokens(template, registry);
    if (attr === 'content') {
      el.content = resolved;
    } else {
      el.textContent = resolved;
      el.dataset.ascTemplate = template;
    }
  });
}

/**
 * Merges `context` into the page-wide token registry, (re)scans the whole document
 * for any not-yet-recorded {{...}} occurrences, then re-resolves everything recorded
 * so far against the full merged registry.
 *
 * Call this whenever new data becomes available — page load (URL params), or a
 * block's async fetch (collection, sheet, ...). Safe to call repeatedly and from
 * multiple blocks; later values for the same accessor simply overwrite earlier ones.
 *
 * @param {object} context
 */
export function registerTokens(context) {
  Object.assign(registry, context);
  scan(document);
  resolveAll();
}
