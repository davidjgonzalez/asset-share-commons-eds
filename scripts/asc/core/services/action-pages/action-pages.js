// ASC Core — do not edit. Customize via scripts/asc/configurations.js
import { loadBlock } from '../../../../aem.js';
import serviceConfigurations from '../configurations.js';

/**
 * Parse an action block element (direct children = DA document sections) into dialog parts.
 *
 * Section position determines semantic role:
 *   first  → header  (h1 = title; remaining elements = bodyNodes)
 *   middle → body    (h2/h3 + ul = renditions or pipe-delimited form fields; other = bodyNodes)
 *   last   → footer  (p elements with #-hash links = action buttons)
 */
export function parseActionFragment(el, ctx = {}) {
  function sub(str) {
    return str.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const val = ctx[key.trim()];
      return val != null ? String(val) : _;
    });
  }

  const sections = [...el.querySelectorAll(':scope > div')];
  const result = {
    title: null, bodyNodes: [], fields: null, renditionLabel: null, renditionIds: null, actions: [],
  };
  if (!sections.length) return result;

  const header = sections[0];
  const footer = sections.length > 1 ? sections[sections.length - 1] : null;
  const body = sections.length > 2 ? sections.slice(1, -1) : [];

  [...header.childNodes].filter((n) => n.nodeType === Node.ELEMENT_NODE).forEach((node) => {
    if (node.tagName.toLowerCase() === 'h1' && !result.title) {
      result.title = node.textContent.trim();
    } else {
      const clone = node.cloneNode(true);
      clone.innerHTML = sub(clone.innerHTML);
      result.bodyNodes.push(clone);
    }
  });

  body.forEach((section) => {
    const nodes = [...section.childNodes].filter((n) => n.nodeType === Node.ELEMENT_NODE);
    let i = 0;
    while (i < nodes.length) {
      const node = nodes[i];
      const tag = node.tagName.toLowerCase();
      if ((tag === 'h2' || tag === 'h3') && nodes[i + 1]?.tagName?.toLowerCase() === 'ul') {
        const items = [...nodes[i + 1].querySelectorAll('li')]
          .map((li) => li.textContent.trim()).filter(Boolean);
        if (items.some((item) => item.includes('|'))) {
          result.fields = items.map((item) => {
            const [id, type, label, placeholder = '', suffix = ''] = item.split('|').map((s) => s.trim());
            return {
              id, type, label, placeholder, suffix,
            };
          }).filter((f) => f.id && f.type);
        } else {
          result.renditionLabel = node.textContent.trim();
          result.renditionIds = items;
        }
        i += 1; // skip the paired ul
      } else {
        const clone = node.cloneNode(true);
        clone.innerHTML = sub(clone.innerHTML);
        result.bodyNodes.push(clone);
      }
      i += 1;
    }
  });

  if (footer) {
    [...footer.childNodes].filter((n) => n.nodeType === Node.ELEMENT_NODE).forEach((node) => {
      if (node.tagName.toLowerCase() === 'p') {
        [...node.querySelectorAll('a')].forEach((a) => {
          const hash = a.getAttribute('href');
          if (hash?.startsWith('#')) result.actions.push({ label: a.textContent.trim(), hash });
        });
      }
    });
  }

  return result;
}

export function wireDialogClose(dialog) {
  dialog.querySelectorAll('[data-dialog-close]').forEach((btn) => {
    btn.addEventListener('click', () => dialog.close());
  });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
}

class ActionPages {
  constructor(config) {
    this.root = (config?.root || '/actions').replace(/\/$/, '');
    this.initClickHandler();
  }

  initClickHandler() {
    document.addEventListener('click', async (e) => {
      const link = e.target.closest(`a[href^="${this.root}/"]`);
      if (!link) return;
      e.preventDefault();
      await this.trigger(link.getAttribute('href'), ActionPages.contextFromElement(link));
    });
  }

  async trigger(href, ctx = {}) {
    const name = ActionPages.getActionName(href);
    const blockName = `action-${name}`;

    window.asc = window.asc || {};
    window.asc.pendingAction = ctx;

    const content = await ActionPages.fetchContent(href);
    const blockEl = document.createElement('div');
    blockEl.className = blockName;
    if (content) {
      [...content.children].forEach((child) => blockEl.appendChild(child.cloneNode(true)));
    }

    blockEl.classList.add('block');
    blockEl.dataset.blockName = blockName;
    blockEl.dataset.blockStatus = 'initialized';

    await loadBlock(blockEl);
    delete window.asc.pendingAction;
  }

  static getActionName(href) {
    const path = new URL(href, window.location.origin).pathname;
    return path.replace(/\/$/, '').split('/').pop();
  }

  static async fetchContent(href) {
    try {
      const resp = await fetch(`${href}.plain.html`);
      if (!resp.ok) return null;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = await resp.text();
      return wrapper;
    } catch {
      return null;
    }
  }

  static contextFromElement(el) {
    const ctx = {};
    let node = el;
    while (node && node !== document.body) {
      Object.entries(node.dataset || {}).forEach(([key, val]) => {
        if (key.startsWith('action') && key.length > 'action'.length) {
          const ctxKey = key.slice('action'.length).replace(/^[A-Z]/, (c) => c.toLowerCase());
          if (!(ctxKey in ctx)) ctx[ctxKey] = val;
        }
      });
      node = node.parentElement;
    }
    return ctx;
  }
}

const instance = new ActionPages(serviceConfigurations.actions || {});
export const triggerAction = (href, ctx) => instance.trigger(href, ctx);
export default instance;
