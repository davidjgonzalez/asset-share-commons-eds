/** @owner user */
import services from '../../scripts/asc/core/services/services.js';
import AssetAccessError from '../../scripts/asc/core/models/asset-access-error.js';
import { getBoardTextItems } from './storage.js';

export async function loadFromCollection(id) {
  const collection = await services.collections.get(id, true);
  if (!collection) return null;
  // Keep forbidden items too — the recipient of a shared collection may lack access to
  // some of the assets in it; those render as a locked placeholder (see board-item.js)
  // instead of silently disappearing.
  const assetItems = (collection.hydratedItems || [])
    .filter((i) => i.type === 'asset' && (i.asset || i.forbidden));
  const textItems = getBoardTextItems(id);
  return { collection, assetItems, textItems };
}

export async function loadFromSheet(sheetParam) {
  if (!sheetParam) {
    return {
      meta: { title: '', description: '', expiresAt: null },
      assetItems: [],
      textItems: [],
    };
  }
  const payload = await services.url.decodeSheetPayload(sheetParam);
  if (!payload) {
    return { meta: { invalid: true, title: '', description: '', expiresAt: null }, assetItems: [], textItems: [] };
  }

  const {
    title = '', description = '', expiresAt = null, items = [], textElements = [],
  } = payload;

  const assetIds = items.filter((i) => i.type === 'asset').map((i) => i.id);
  const fetchedAssets = await Promise.all(assetIds.map((id) => services.search.getAssetById(id)));
  // Keyed by the requested id, not the resolved asset's uuid — same reasoning as
  // collections.js _hydrateAssets: a forbidden/missing lookup has no uuid of its own.
  const resultMap = new Map(assetIds.map((id, i) => [id, fetchedAssets[i]]));

  const assetItems = items
    .filter((i) => i.type === 'asset')
    .map((i) => {
      const result = resultMap.get(i.id);
      const forbidden = result instanceof AssetAccessError;
      return { ...i, asset: forbidden ? null : result, forbidden };
    })
    .filter((i) => i.asset || i.forbidden);

  return {
    meta: { title, description, expiresAt },
    assetItems,
    textItems: textElements,
  };
}

/**
 * A "published collection" — a fixed set of assets a site owner curates once by
 * authoring their ids/paths directly on the page (config.items), rather than a
 * personal collection built by a visitor or a compressed one-off ?sheet= link.
 * Publishable/linkable/discoverable the same way any other page is, because it
 * IS a page — no server-side storage of its own beyond what AEM already is.
 * Always read-only (view mode): there's no owning collection to drag positions
 * back into, only a page an editor updates by changing the authored list itself.
 */
export async function loadFromAuthoredList(ids) {
  if (!ids.length) return { assetItems: [], textItems: [] };
  const fetchedAssets = await services.authoredAssets.resolveAssetReferences(ids);
  const assetItems = ids
    .map((id, i) => {
      const result = fetchedAssets[i];
      const forbidden = result instanceof AssetAccessError;
      return { type: 'asset', id, asset: forbidden ? null : result, forbidden };
    })
    .filter((i) => i.asset || i.forbidden);
  return { assetItems, textItems: [] };
}

export function sheetParamFromUrl(sheetUrl) {
  if (!sheetUrl) return null;
  try {
    return new URL(sheetUrl, window.location.origin).searchParams.get('sheet');
  } catch {
    return null;
  }
}
