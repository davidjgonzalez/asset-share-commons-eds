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

import serviceConfigurations from '../configurations.js';
import staticResolver from './resolvers/static.js';
import dmScene7Resolver from './resolvers/dm-scene7.js';
import urlResolver from './resolvers/url.js';
import urlTemplateResolver from './resolvers/url-template.js';
import dmOpenApiResolver from './resolvers/dm-openapi.js';
import webOptimizedDeliveryResolver from './resolvers/web-optimized-delivery.js';

const BUILT_IN_RESOLVERS = [
  staticResolver,
  dmScene7Resolver,
  urlResolver,
  urlTemplateResolver,
  dmOpenApiResolver,
  webOptimizedDeliveryResolver,
];

/**
 * Default rendition definitions — usable for any AEM instance that runs standard
 * DAM processing profiles (which generate cq5dam.web.* and cq5dam.thumbnail.* nodes).
 *
 * Override entirely or extend via configurations.renditions.definitions.
 */
const DEFAULT_DEFINITIONS = [
  {
    id: 'thumbnail',
    label: 'Thumbnail',
    type: 'static',
    name: /^cq5dam\.thumbnail\.319\.319\./,
    visible: false,
  },
  {
    id: 'web',
    label: 'Web',
    type: 'static',
    name: /^cq5dam\.web\./,
    accepts: (asset) => asset.mimeType?.startsWith('image/'),
  },
  {
    id: 'original',
    label: 'Original',
    type: 'static',
    name: 'original',
  },
];

/**
 * Default display ladder — the renditions that represent an asset across the site
 * (cards, lists, masonry, boards, teasers). Used for <img srcset>; never shown in
 * the download list. Each entry needs `size.width` for the srcset descriptor.
 *
 * Images go through web-optimized-delivery (Dynamic Media Smart Imaging), which
 * resizes proportionally by width only, so the shape stays the asset's own and CSS
 * decides any crop. Non-image assets (video, PDF, Office docs) can't use that
 * endpoint, so they use AEM's standard square cq5dam.thumbnail.* renditions.
 *
 * Override entirely via configurations.renditions.display.
 */
const isImage = (asset) => asset.mimeType?.startsWith('image/');
const DEFAULT_DISPLAY = [
  { type: 'web-optimized-delivery', size: { width: 100 }, params: 'width=100&preferwebp=true&quality=85', accepts: isImage },
  { type: 'web-optimized-delivery', size: { width: 320 }, params: 'width=320&preferwebp=true&quality=85', accepts: isImage },
  { type: 'web-optimized-delivery', size: { width: 640 }, params: 'width=640&preferwebp=true&quality=80', accepts: isImage },
  { type: 'web-optimized-delivery', size: { width: 1280 }, params: 'width=1280&preferwebp=true&quality=70', accepts: isImage },
  { type: 'web-optimized-delivery', size: { width: 1920 }, params: 'width=1920&preferwebp=true&quality=70', accepts: isImage },
  { type: 'static', name: 'cq5dam.thumbnail.48.48.png', size: { width: 48 }, accepts: (asset) => !isImage(asset) },
  { type: 'static', name: 'cq5dam.thumbnail.140.100.png', size: { width: 140 }, accepts: (asset) => !isImage(asset) },
  { type: 'static', name: 'cq5dam.thumbnail.319.319.png', size: { width: 319 }, accepts: (asset) => !isImage(asset) },
];

/**
 * AEM rendition node names hidden from resolved renditions (thumbnail nodes,
 * text/metadata sidecars, swatches). Override via configurations.renditions.exclude.
 */
const DEFAULT_EXCLUDE = [
  /^cq5dam\.thumbnail\./,
  /^cqdam\..+\.json$/,
  'cqdam.metadata.xml',
  'Swatch',
];

/**
 * Renditions service — resolves rendition URLs for an asset.
 *
 * Resolution is driven by a resolver registry. Each resolver handles one
 * rendition type and implements up to two paths:
 *
 *   fromDefinition(def, asset, aemConfig) → Rendition | null
 *     Used by explicit definitions in configurations.renditions.definitions.
 *
 *   acceptsNode(name, node) → boolean
 *   fromNode(name, node, asset, aemConfig) → Rendition | null
 *     Used when scanning jcr:content/renditions/* nodes (autoDetect and 'all' mode).
 *
 * Built-in resolvers: static, dm-scene7, url, url-template, dm-openapi,
 * web-optimized-delivery.
 *
 * Add custom resolvers via configurations.renditions.resolvers (object keyed by type).
 * Custom resolvers override built-ins of the same type.
 *
 * ## Rendition types
 *
 * ### `type: 'static'`
 * Matches a rendition node from the asset's jcr:content/renditions/* tree.
 * `name` is a string (exact match), RegExp (pattern match), or
 * (asset) => string (dynamic exact match).
 *
 * ### `type: 'url'`
 * `url` is a function (asset) => string that returns the full URL.
 * Use for fully custom URL construction with arbitrary JS logic.
 *
 * ### `type: 'url-template'`
 * `template` is a string with `${variable}` tokens resolved at runtime.
 * Returns null automatically if any token is absent on the asset.
 *
 * Supported tokens:
 *   ${asset.path}       Full JCR path
 *   ${asset.name}       Filename (node name, e.g. "photo.jpg")
 *   ${asset.extension}  File extension (e.g. "jpg")
 *   ${rendition.name}   This definition's id
 *   ${dm.name}          dam:scene7Name
 *   ${dm.id}            dam:scene7ID
 *   ${dm.file}          dam:scene7File  (e.g. "CompanyFolder/photo")
 *   ${dm.folder}        dam:scene7Folder
 *   ${dm.domain}        dam:scene7Domain  ← IS/IR delivery CDN host
 *   ${dm.api-server}    dam:scene7APIServer  ← Scene7 management API (not delivery)
 *
 * ### `type: 'dm-scene7'`
 * Classic Dynamic Media (Scene7) IS-protocol smart crop.
 * URL: {dam:scene7Domain}/is/image/{dam:scene7File}:{cropName}
 * Auto-detected from jcr:content/renditions nodes with
 * sling:resourceType "dam/rendition/smartcrop" — no definitions needed.
 * An explicit definition never hardcodes the DM crop name as `def.id` — it looks
 * the real node up from the asset's renditions tree via `def.smartCropId` (the
 * exact, case-sensitive DM-registered crop name; falls back to `def.id` if
 * omitted). The resolved rendition's `id` defaults to the matched node's real
 * name; `def.id` only overrides it if explicitly set.
 *
 * ### `type: 'dm-openapi'`
 * AEM Asset Delivery API (AEMaaCS). Requires aem.deliveryHost in configurations.js.
 *
 * ### `type: 'web-optimized-delivery'`
 * Web-optimized delivery via dm-aid-- prefix (AEMaaCS). Requires aem.deliveryHost.
 */
class RenditionsService {
  constructor(config, aemConfig) {
    this.definitions = config.definitions || DEFAULT_DEFINITIONS;
    this._displayDefs = config.display || DEFAULT_DISPLAY;
    this._excludePatterns = config.exclude || DEFAULT_EXCLUDE;
    this._aemConfig = aemConfig || {};

    // Built-in resolvers, optionally overridden/extended by user-provided ones
    this._resolvers = new Map(BUILT_IN_RESOLVERS.map((r) => [r.type, r]));
    Object.entries(config.resolvers || {}).forEach(([type, resolver]) => {
      this._resolvers.set(type, resolver);
    });
  }

  /**
   * Get all renditions for an asset.
   * Returns definition-resolved renditions + any auto-detected node-backed renditions
   * (resolvers with autoDetect: true) not already covered by a definition.
   * @param {Asset} asset
   * @returns {Rendition[]}
   */
  getRenditions(asset) {
    const defined = this.definitions
      .map((def) => this._resolveFromDef(def, asset))
      .filter(Boolean);

    const definedUrls = new Set(defined.map((r) => r.url).filter(Boolean));
    const auto = this._resolveFromNodes(asset, true)
      .filter((r) => !definedUrls.has(r.url));

    return [...defined, ...auto];
  }

  /**
   * Get a single rendition by definition ID.
   * Returns the first definition with this ID whose resolver succeeds for this asset.
   * @param {Asset} asset
   * @param {string} id
   * @returns {Rendition|null}
   */
  getRendition(asset, id) {
    for (const def of this.definitions) {
      if (def.id !== id) continue;
      const resolved = this._resolveFromDef(def, asset);
      if (resolved) return resolved;
    }
    return null;
  }

  /**
   * Get a raw rendition definition by ID (not resolved — no asset needed).
   * @param {string} id
   * @returns {object|null}
   */
  getRenditionDefinition(id) {
    return this.definitions.find((d) => d.id === id) ?? null;
  }

  /**
   * Get the best single URL for representing an asset on the site — the `src`
   * fallback that goes with getDisplaySrcset().
   * @param {Asset} asset
   * @returns {string|null}
   */
  getDisplayUrl(asset) {
    const resolved = this.getRendition(asset, 'thumbnail');
    if (resolved?.url) return resolved.url;

    const srcset = this.getDisplaySrcset(asset);
    if (srcset.length) {
      return srcset[Math.floor(srcset.length / 2)].url;
    }

    const aemHost = this._aemConfig.host || '';
    return `${aemHost}${asset.path}/_jcr_content/renditions/cq5dam.thumbnail.319.319.png`;
  }

  /**
   * Get all display renditions sorted smallest to largest, for <img srcset>.
   * See configurations.renditions.display.
   * @param {Asset} asset
   * @returns {Rendition[]}
   */
  getDisplaySrcset(asset) {
    return this._srcsetFromDefs(this._displayDefs, asset);
  }

  _srcsetFromDefs(defs, asset) {
    return defs
      .filter((def) => def.size?.width)
      .map((def) => this._resolveFromDef(def, asset))
      .filter(Boolean)
      .sort((a, b) => (a.size?.width || 0) - (b.size?.width || 0));
  }

  /**
   * Scan every jcr:content/renditions/* node through registered resolvers and
   * return one Rendition per matching node. Used by the details-renditions block's
   * `renditions: all` mode. Exclude patterns from configurations.renditions.exclude
   * are applied; invisible definition-matched renditions are not filtered here —
   * the block is responsible for that.
   * @param {Asset} asset
   * @returns {Rendition[]}
   */
  resolveAllNodes(asset) {
    return this._resolveFromNodes(asset, false)
      .filter((r) => !this._isExcluded(r.id));
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _resolveFromDef(def, asset) {
    if (!this._accepts(def, asset)) return null;
    const resolver = this._resolvers.get(def.type);
    if (!resolver) {
      console.warn(`[ASC] Unknown rendition type: "${def.type}" on definition "${def.id}"`);
      return null;
    }
    const rendition = resolver.fromDefinition?.(def, asset, this._aemConfig) ?? null;
    if (rendition && def.filename) {
      rendition.filename = typeof def.filename === 'function'
        ? def.filename(rendition, asset)
        : def.filename;
    }
    // Not every resolver type forwards `usecase` from the definition onto the
    // resolved Rendition itself — forward it here once, for all types, rather
    // than leaving callers to patch it in per-type.
    if (rendition && !rendition.usecase && def.usecase) {
      rendition.usecase = def.usecase;
    }
    return rendition;
  }

  _accepts(def, asset) {
    if (!def.accepts) return true;
    return def.accepts(asset);
  }

  /**
   * Iterate jcr:content/renditions/* and route each object-valued node through the
   * first resolver whose acceptsNode() returns true.
   * @param {Asset} asset
   * @param {boolean} autoOnly  When true, skip resolvers with autoDetect !== true.
   * @returns {Rendition[]}
   */
  _resolveFromNodes(asset, autoOnly) {
    const nodes = asset.data?.['jcr:content']?.['renditions'];
    if (!nodes || typeof nodes !== 'object') return [];

    const results = [];
    for (const [name, node] of Object.entries(nodes)) {
      if (typeof node !== 'object' || node === null) continue;
      for (const resolver of this._resolvers.values()) {
        if (!resolver.acceptsNode) continue;
        if (autoOnly && !resolver.autoDetect) continue;
        if (resolver.acceptsNode(name, node)) {
          const r = resolver.fromNode?.(name, node, asset, this._aemConfig);
          if (r) results.push(r);
          break;
        }
      }
    }
    return results;
  }

  _isExcluded(nodeName) {
    if (!nodeName || !this._excludePatterns.length) return false;
    return this._excludePatterns.some((pattern) =>
      pattern instanceof RegExp ? pattern.test(nodeName) : pattern === nodeName,
    );
  }
}

export default new RenditionsService(
  serviceConfigurations.renditions || {},
  serviceConfigurations.aem || {},
);
