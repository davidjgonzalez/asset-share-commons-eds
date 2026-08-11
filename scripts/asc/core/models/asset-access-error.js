// ASC Core — do not edit. Customize via scripts/asc/configurations.js

/**
 * Returned by a search provider's getAssetById() in place of an Asset when the lookup
 * failed with a definite "no permission" signal (HTTP 401/403) from the underlying API —
 * as opposed to `null`, which means "not found" (or, for providers whose endpoint can't
 * distinguish the two, always means "unknown"; see the comment on QueryBuilderProvider's
 * getAssetById()). Consumers that want to represent "you don't have access to this asset"
 * distinctly from "this asset doesn't exist" check for this type before falling back to
 * treating a bare `null` as not-found.
 */
export default class AssetAccessError {
  constructor(id, status) {
    this.id = id;
    this.status = status;
  }
}
