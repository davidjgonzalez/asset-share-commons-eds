// ASC Core — do not edit. Customize via scripts/configurations.js
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
import Rendition from '../../models/rendition.js';

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
    name: /^cq5dam\.thumbnail\./,
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
 * Renditions service — client-side equivalent of ASC v1's AssetRenditionDispatcher.
 *
 * Resolves rendition URLs for an asset based on definitions in configurations.js.
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
 * Use for Dynamic Media / Scene7 presets and smart crops — call
 * asset.getProperty('dam:scene7APIServer') etc. directly.
 *
 * ### `type: 'asset-delivery'`
 * Constructs an AEM Asset Delivery API URL (AEM as a Cloud Service only).
 * Requires aem.deliveryHost in configurations.js.
 * The `params` property is appended as query string.
 */
class RenditionsService {
  constructor(config, aemConfig) {
    this.definitions = config.definitions || DEFAULT_DEFINITIONS;
    this._excludePatterns = config.exclude || [];  // NEW
    this._aemConfig = aemConfig || {};
  }

  /**
   * Get all renditions for an asset (includes non-visible ones like thumbnails).
   * @param {Asset} asset
   * @returns {Rendition[]}
   */
  getRenditions(asset) {
    return this.definitions
      .map((def) => this._resolve(def, asset))
      .filter(Boolean);
  }

  /**
   * Get a single rendition by definition ID.
   * If multiple definitions share the same ID (e.g. 'thumbnail' for image vs video),
   * returns the first one whose accepts() check passes for this asset.
   * Returns null if no matching definition accepts this asset or can be resolved.
   * @param {Asset} asset
   * @param {string} id
   * @returns {Rendition|null}
   */
  getRendition(asset, id) {
    for (const def of this.definitions) {
      if (def.id !== id) continue;
      const resolved = this._resolve(def, asset);
      if (resolved) return resolved;
    }
    return null;
  }

  /**
   * Get a raw rendition definition by ID (not resolved — no asset needed).
   * Returns null if no definition with that ID exists.
   * Used by the sheet block to read label/description without a specific asset.
   * @param {string} id
   * @returns {object|null}
   */
  getRenditionDefinition(id) {
    return this.definitions.find((d) => d.id === id) ?? null;
  }

  /**
   * Get the best thumbnail URL for an asset. Used by teasers and previews.
   * Falls back to a best-guess static URL if the thumbnail rendition isn't in
   * the asset's rendition data (common for search result assets which don't
   * fetch the full renditions tree).
   * @param {Asset} asset
   * @returns {string|null}
   */
  getThumbnailUrl(asset) {
    const resolved = this.getRendition(asset, 'thumbnail');
    if (resolved?.url) return resolved.url;

    // Fallback: construct the standard thumbnail URL directly.
    // This works when the asset's rendition nodes weren't fetched (e.g. search results).
    // AEM standard processing profiles always generate this node name.
    const aemHost = this._aemConfig.host || '';
    return `${aemHost}${asset.path}/_jcr_content/renditions/cq5dam.thumbnail.319.319.png`;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _resolve(def, asset) {
    if (!this._accepts(def, asset)) return null;

    switch (def.type) {
      case 'static': return this._resolveStatic(def, asset);
      case 'url': return this._resolveUrl(def, asset);
      case 'asset-delivery': return this._resolveAssetDelivery(def, asset);
      default:
        console.warn(`[ASC] Unknown rendition type: "${def.type}" on definition "${def.id}"`);
        return null;
    }
  }

  /**
   * Check whether a rendition definition applies to the given asset.
   * `accepts` must be a function (asset) => boolean, or omitted to match all assets.
   */
  _accepts(def, asset) {
    if (!def.accepts) return true;
    return def.accepts(asset);
  }

  /**
   * Resolve a static rendition by matching the definition's `name` against
   * the asset's JCR rendition nodes.
   * `name` may be:
   *   - string  → exact match against node id
   *   - RegExp  → pattern match against node id
   *   - (asset) => string → called with the asset, result used as exact match
   */
  _resolveStatic(def, asset) {
    const nodes = asset.staticRenditions;
    const nameValue = typeof def.name === 'function' ? def.name(asset) : def.name;
    const match = nameValue instanceof RegExp
      ? nodes.find((r) => nameValue.test(r.id))
      : nodes.find((r) => r.id === nameValue);

    if (!match) return null;
    if (this._isExcluded(match.id)) return null;

    return new Rendition({
      id: def.id,
      label: def.label,
      description: def.description ?? `Static rendition (${match.id})`,
      visible: def.visible ?? true,
      mimeType: match.mimeType ?? def.mimeType ?? null,
      fileSize: match.fileSize ?? null,
      width: match.width ?? null,
      height: match.height ?? null,
      url: match.url,
      path: match.path,
    });
  }

  /**
   * Resolve a URL rendition by calling def.url(asset).
   * Used for Dynamic Media / Scene7 presets and smart crops.
   * The function receives the full Asset model — call asset.getProperty() for metadata.
   */
  _resolveUrl(def, asset) {
    if (typeof def.url !== 'function') {
      console.warn(`[ASC] Rendition "${def.id}" has type "url" but url is not a function.`);
      return null;
    }

    const url = def.url(asset);
    if (!url) return null;

    return new Rendition({
      id: def.id,
      label: def.label,
      description: def.description ?? null,
      visible: def.visible ?? true,
      mimeType: def.mimeType ?? null,
      url,
    });
  }

  /**
   * Resolve an AEM Asset Delivery rendition.
   * URL format: {deliveryHost}/adobe/dynamicmedia/deliver/{uuid}/{filename}.{ext}?{params}
   * AEM as a Cloud Service only — requires aem.deliveryHost in configurations.js.
   */
  _resolveAssetDelivery(def, asset) {
    const { deliveryHost } = this._aemConfig;
    if (!deliveryHost) {
      console.warn('[ASC] Rendition type "asset-delivery" requires aem.deliveryHost in configurations.js');
      return null;
    }

    const ext = def.format || asset.fileExtension || 'jpg';
    const name = asset.path?.split('/').pop() ?? 'asset';
    const params = def.params ? `?${def.params}` : '';
    const url = `${deliveryHost}/adobe/dynamicmedia/deliver/${asset.uuid}/${name}.${ext}${params}`;

    return new Rendition({
      id: def.id,
      label: def.label,
      description: def.description ?? null,
      visible: def.visible ?? true,
      mimeType: def.mimeType ?? null,
      url,
    });
  }

  /**
   * Check whether a static rendition node name matches any exclude pattern.
   * @param {string} nodeName  Raw JCR rendition node name (e.g. 'cq5dam.thumbnail.48.48.png')
   * @returns {boolean}
   */
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
