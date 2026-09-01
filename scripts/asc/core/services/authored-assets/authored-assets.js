// ASC Core — do not edit. Customize via scripts/asc/configurations.js
import serviceConfigurations from '../configurations.js';
import search from '../search/search.js';

/**
 * Resolves authored asset references — either a raw UUID or an exact DAM path,
 * typed directly onto a page (see `board.js`'s `source: authored` and
 * `share-directory.js`) — through the active search provider, with a bounded
 * concurrency pool so a long authored list doesn't fire an unbounded burst of
 * requests. Override resolution entirely via
 * `configurations.authoredAssets.resolveReference`.
 */
class AuthoredAssetsService {
  constructor(config) {
    this.config = config || {};
  }

  /**
   * Parse a rich-text cell containing one asset reference per line. DA/UE may
   * represent line breaks as paragraphs, list items, or <br> elements, so plain
   * textContent is not sufficient.
   */
  parseAssetReferences(cell) {
    if (!cell) return [];
    const copy = cell.cloneNode(true);
    copy.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
    copy.querySelectorAll('p, li').forEach((line) => line.append('\n'));
    return copy.textContent
      .split(/[\n,]+/)
      .map((value) => value.trim())
      .filter(Boolean);
  }

  /** Resolve either a UUID or an exact DAM asset path through the active provider. */
  async resolveAssetReference(reference) {
    if (!reference) return null;
    if (!reference.startsWith('/')) return search.getAssetById(reference);

    const result = await search.searchSilent(new Map([
      ['path', reference],
      ['path.exact', 'true'],
      ['p.limit', '2'],
    ]));
    return result.assets?.find((asset) => asset.path === reference) || null;
  }

  /**
   * Resolve references in stable order without creating an unbounded request burst.
   * @param {string[]} references
   * @param {{ concurrency?: number }} [options] - per-call override of configurations.authoredAssets.concurrency
   */
  async resolveAssetReferences(references, options = {}) {
    const concurrency = options.concurrency ?? this.config.concurrency ?? 4;
    const resolver = this.config.resolveReference || this.resolveAssetReference;

    const results = new Array(references.length);
    let next = 0;

    async function worker() {
      while (next < references.length) {
        const index = next;
        next += 1;
        try {
          results[index] = await resolver(references[index]);
        } catch {
          results[index] = null;
        }
      }
    }

    const workerCount = Math.min(Math.max(1, concurrency), references.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
  }
}

export default new AuthoredAssetsService(serviceConfigurations.authoredAssets || {});
