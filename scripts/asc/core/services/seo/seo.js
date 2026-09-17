// ASC Core — do not edit. Customize via scripts/asc/configurations.js
// Copyright 2025 David G.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * SEO / page-metadata service — sets document.title, meta description,
 * canonical link, Open Graph + Twitter Card tags, and JSON-LD structured data.
 *
 * Two paths:
 *  - applyPage() — called once per page load (from ascLazy(), after page-type
 *    body classes are set) and again by any configured customListeners.
 *  - applyAsset()/restore() — driven by observing the Asset Details modal's
 *    DOM directly (not the asc:asset:details:open/close events), because only
 *    one of AssetDetails.open()'s four call sites (teaser click) dispatches
 *    that event — deep-link loads, back/forward, and Prev/Next inside the
 *    modal all call open() directly. Every path ends the same way though:
 *    the fragment swapped into .details-modal .content always carries
 *    data-asc-asset, and the dialog always fires a native 'close' event
 *    (button, Escape, or programmatic .close()). Observing those is
 *    trigger-independent. Full rationale + config reference: docs/SEO.md
 */
import { getMetadata } from '../../../../aem.js';
import serviceConfigurations from '../configurations.js';
import renditions from '../renditions/renditions.js';

const JSONLD_SELECTOR = 'script[type="application/ld+json"][data-asc-seo]';

function jsonLdTypeForMimeType(mimeType) {
  if (mimeType?.startsWith('image/')) return 'ImageObject';
  if (mimeType?.startsWith('video/')) return 'VideoObject';
  return 'DigitalDocument';
}

function pageTypeFromBody() {
  const { classList } = document.body;
  if (classList.contains('page-search')) return 'search';
  if (classList.contains('page-collections')) return 'collections';
  if (classList.contains('page-sheet')) return 'sheet';
  if (classList.contains('page-board')) return 'board';
  return 'default';
}

class Seo {
  constructor(config) {
    this.config = config || {};
    this._pageSnapshot = null;
    this._assetModeActive = false;

    if (this.isEnabled()) this._wireAssetDetailsObservers();

    (this.config.customListeners || [])
      .forEach(([target, type, handler]) => target.addEventListener(type, handler));
  }

  isEnabled() {
    return this.config.enabled !== false;
  }

  // ── Low-level DOM writers ──────────────────────────────────────────────
  // A field that's `undefined` leaves the tag alone; `null` removes it; any
  // other value sets it. This tri-state is what lets page/asset hooks layer
  // additively on top of authored content instead of blind-replacing it.

  setMeta({ title, description, image, imageAlt, canonical, type, siteName } = {}) {
    if (title !== undefined) document.title = title ?? '';

    this._setMetaTag('description', description);
    this._setLinkTag('canonical', canonical);

    this._setMetaTag('og:title', title);
    this._setMetaTag('og:description', description);
    this._setMetaTag('og:image', image);
    this._setMetaTag('og:url', canonical);
    this._setMetaTag('og:type', type);
    this._setMetaTag('og:site_name', siteName);

    this._setMetaTag('twitter:card', image === undefined ? undefined : (image ? 'summary_large_image' : null));
    this._setMetaTag('twitter:title', title);
    this._setMetaTag('twitter:description', description);
    this._setMetaTag('twitter:image', image);
    this._setMetaTag('twitter:image:alt', imageAlt);
  }

  setJsonLd(data) {
    const existing = document.head.querySelector(JSONLD_SELECTOR);
    if (data == null) {
      existing?.remove();
      return;
    }
    const json = JSON.stringify(data);
    if (existing) {
      existing.textContent = json;
      return;
    }
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.ascSeo = 'true';
    script.textContent = json;
    document.head.appendChild(script);
  }

  _setMetaTag(name, value) {
    if (value === undefined) return;
    // Mirrors getMetadata()'s own rule (scripts/aem.js) so every tag this
    // service writes stays readable through the same helper.
    const attr = name.includes(':') ? 'property' : 'name';
    const selector = `meta[${attr}="${name}"]`;
    let el = document.head.querySelector(selector);
    if (value === null) {
      el?.remove();
      return;
    }
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', value);
  }

  _setLinkTag(rel, value) {
    if (value === undefined) return;
    let el = document.head.querySelector(`link[rel="${rel}"]`);
    if (value === null) {
      el?.remove();
      return;
    }
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', rel);
      document.head.appendChild(el);
    }
    el.setAttribute('href', value);
  }

  // ── Snapshot / restore ───────────────────────────────────────────────────
  // Single slot — the Asset Details overlay never nests.

  _snapshotHead() {
    return {
      title: document.title,
      description: getMetadata('description') || null,
      image: getMetadata('og:image') || null,
      imageAlt: getMetadata('twitter:image:alt') || null,
      canonical: document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
      type: getMetadata('og:type') || null,
      siteName: getMetadata('og:site_name') || null,
      jsonLd: document.head.querySelector(JSONLD_SELECTOR)?.textContent ?? null,
    };
  }

  restore() {
    if (!this._pageSnapshot) return;
    const { jsonLd, ...meta } = this._pageSnapshot;
    this.setMeta(meta);
    this.setJsonLd(jsonLd ? JSON.parse(jsonLd) : null);
    this._pageSnapshot = null;
    this._assetModeActive = false;
  }

  // ── Page-type path ────────────────────────────────────────────────────────

  /**
   * Apply page-level metadata for the current page type. Called once from
   * ascLazy() (page-type body classes are already set by then) and again by
   * any configured customListeners (e.g. after a search completes).
   */
  applyPage() {
    if (!this.isEnabled()) return;

    const type = pageTypeFromBody();
    const ctx = {
      type,
      url: window.location.href,
      searchParams: new URLSearchParams(window.location.search),
      siteName: this.config.siteName,
    };

    const overrides = this.config.pages?.[type]?.(ctx) || {};
    const jsonLdData = this.config.jsonLd?.[type]?.(ctx) ?? null;

    const meta = {
      title: overrides.title,
      description: overrides.description,
      image: overrides.image ?? this.config.defaultImage,
      imageAlt: overrides.imageAlt,
      canonical: overrides.canonical,
      type: overrides.type,
      siteName: this.config.siteName,
    };

    if (this._assetModeActive) {
      // The Asset Details overlay is currently showing its own metadata —
      // don't touch the live DOM, just update what restore() will reveal.
      // Only merge fields this page type actually set: `meta` deliberately
      // carries `undefined` for un-overridden fields (setMeta()'s "leave
      // alone" signal), and a plain spread would copy those `undefined`s
      // into the snapshot too, wiping out the real pre-asset values that
      // _snapshotHead() already captured for restore() to reveal later.
      const definedFields = Object.fromEntries(
        Object.entries(meta).filter(([, value]) => value !== undefined),
      );
      this._pageSnapshot = {
        ...this._pageSnapshot,
        ...definedFields,
        jsonLd: jsonLdData ? JSON.stringify(jsonLdData) : null,
      };
      return;
    }

    this.setMeta(meta);
    this.setJsonLd(jsonLdData);
  }

  // ── Asset Details path ───────────────────────────────────────────────────

  applyAsset(asset) {
    if (!this.isEnabled() || !asset) return;

    if (!this._assetModeActive) {
      this._pageSnapshot = this._snapshotHead();
      this._assetModeActive = true;
    }

    const overrides = this.config.assetDetails?.(asset) || {};
    const image = overrides.image
      ?? renditions.getRendition(asset, 'web')?.url
      ?? asset.thumbnail
      ?? this.config.defaultImage;

    const meta = {
      title: overrides.title ?? asset.title,
      description: overrides.description ?? asset.description,
      image,
      imageAlt: overrides.imageAlt ?? asset.title,
      canonical: this._assetCanonicalUrl(asset),
      type: overrides.type ?? 'article',
      siteName: this.config.siteName,
    };
    this.setMeta(meta);
    this.setJsonLd(this._buildJsonLd(asset, meta));
  }

  /**
   * Canonical URL for an asset — strips every existing query param (search
   * filters, pagination, etc.) and the hash, so it's never a noisy search
   * URL, then sets only ?asset=. config.canonicalBase (if set) should point
   * at a real authored page: AssetDetails auto-opens off ?asset= alone with
   * no pathname check, so any page works, but an unauthored canonicalBase
   * makes the canonical URL 404 if actually visited.
   */
  _assetCanonicalUrl(asset) {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    if (this.config.canonicalBase) url.pathname = this.config.canonicalBase;
    url.searchParams.set('asset', asset.uuid);
    return url.toString();
  }

  _buildJsonLd(asset, meta) {
    const base = {
      '@context': 'https://schema.org',
      '@type': jsonLdTypeForMimeType(asset.mimeType),
      name: meta.title,
      description: meta.description,
      contentUrl: meta.image,
      url: meta.canonical,
    };
    const webRendition = renditions.getRendition(asset, 'web');
    if (webRendition?.width) base.width = webRendition.width;
    if (webRendition?.height) base.height = webRendition.height;

    const hook = this.config.jsonLd?.assetDetails;
    if (!hook) return base;
    const result = hook(asset);
    if (result === null) return null;
    return { ...base, ...result };
  }

  // ── DOM observation (see class doc for why this replaces event listening) ──

  _wireAssetDetailsObservers() {
    const existing = document.querySelector('.details-modal');
    if (existing) {
      this._attachModalObservers(existing);
      return;
    }
    const bodyObserver = new MutationObserver(() => {
      const modal = document.querySelector('.details-modal');
      if (modal) {
        bodyObserver.disconnect();
        this._attachModalObservers(modal);
      }
    });
    bodyObserver.observe(document.body, { childList: true });
  }

  _attachModalObservers(modal) {
    const dialog = modal.querySelector('dialog');
    const content = modal.querySelector('.content');
    if (!dialog || !content) return;

    const contentObserver = new MutationObserver(async () => {
      const assetId = content.querySelector('[data-asc-asset]')?.dataset.ascAsset;
      if (!assetId) return;
      const { default: search } = await import('../search/search.js');
      const asset = await search.getAssetById(assetId);
      if (asset) this.applyAsset(asset);
    });
    contentObserver.observe(content, { childList: true });

    dialog.addEventListener('close', () => this.restore());
  }
}

export default new Seo(serviceConfigurations.seo || {});
