// ASC Core — do not edit. Customize via scripts/asc/configurations.js
import serviceConfigurations from "../configurations.js";

// Bump only when the sheet-payload wire shape changes in a way a v1 decoder
// couldn't read (e.g. an item's shape is restructured or renamed). Adding a
// new optional key to the payload, or to an item within it, is NOT a breaking
// change — destructure it with a default at the read site; older links just
// omit it.
const SHEET_PAYLOAD_VERSION = 1;

class Url {
  constructor(config) {
    this.config = config || {};
  }

  toBase64Url(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  fromBase64Url(base64) {
    const binary = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // 1. Compress an array of values into a URL-safe string
  async compressArray(values) {
    if (!values) {
      return "";
    }

    const text = values.join(","); // Join with commas (or another delimiter)
    const data = new TextEncoder().encode(text);

    const cs = new CompressionStream("deflate");
    const writer = cs.writable.getWriter();
    writer.write(data);
    writer.close();

    const compressed = await new Response(cs.readable).arrayBuffer();
    return this.toBase64Url(new Uint8Array(compressed));
  }

  // 2. Decompress back into an array of values.
  // Returns null (rather than throwing) on a corrupted/tampered `encoded`
  // value — e.g. a hand-edited `?sheet=` URL — so callers can show an
  // explicit invalid-link state instead of an uncaught exception.
  async decompressToArray(encoded) {
    if (!encoded) {
      return [];
    }

    try {
      const bytes = this.fromBase64Url(encoded);

      const ds = new DecompressionStream("deflate");
      const writer = ds.writable.getWriter();
      writer.write(bytes);
      writer.close();

      const decompressed = await new Response(ds.readable).arrayBuffer();
      const text = new TextDecoder().decode(decompressed);
      return text.split(","); // Split back into array
    } catch (err) {
      console.warn("[ASC] Failed to decompress URL payload — treating as invalid:", err);
      return null;
    }
  }

  // 3. Encode a versioned sheet-share payload (`?sheet=`) — the title/items/etc.
  // for an ad hoc collection share. Items and any other payload fields are
  // plain objects/values, not delimited strings, so adding a new one later
  // (e.g. a per-item or per-share rendition list) needs no new parsing —
  // callers just read the extra key with a default.
  async encodeSheetPayload(payload) {
    return this.compressArray([JSON.stringify({ v: SHEET_PAYLOAD_VERSION, ...payload })]);
  }

  // 4. Decode a payload built by encodeSheetPayload. Returns null for corrupt,
  // tampered, or unrecognized-version input so callers can show an explicit
  // invalid-link state rather than guessing at a shape they don't support.
  async decodeSheetPayload(encoded) {
    const parts = await this.decompressToArray(encoded);
    if (!parts) return null;
    let payload;
    try {
      payload = JSON.parse(parts.join(","));
    } catch {
      return null;
    }
    return payload?.v === SHEET_PAYLOAD_VERSION ? payload : null;
  }

  // 5. Build a collection URL from an array of asset IDs
  async toCollectionUrl(assetIds, options = {}) {
    const param = options.param || "assets";

    // Build base URL: strip any existing instance of the param
    let base;
    if (options.base) {
      base = options.base;
    } else {
      const u = new URL(window.location.href);
      u.searchParams.delete(param);
      base = u.toString();
    }

    if (!assetIds || assetIds.length === 0) {
      return base;
    }

    const compressed = await this.compressArray(assetIds);
    const u = new URL(base);
    u.searchParams.set(param, compressed);
    return u.toString();
  }

  // 6. Read asset IDs from a collection URL search string
  async fromCollectionUrl(searchString = window.location.search, param = "assets") {
    const params = new URLSearchParams(searchString);
    const value = params.get(param);
    if (!value) {
      return [];
    }
    return this.decompressToArray(value);
  }

  /**
   * Strip the origin off an authored URL and re-anchor it to the current domain.
   *
   * Authors paste share/sheet links copied from whichever environment they were
   * on at the time (aem.live, aem.page, localhost:3000, a custom domain, …) — the
   * domain embedded in a pasted URL is never meaningful, only the path/query/hash
   * is. Using it verbatim would silently send visitors on one environment off to
   * whichever environment the link happened to be copied from.
   */
  toRelativeUrl(input) {
    if (!input) return input;
    try {
      const url = new URL(input, window.location.origin);
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return input;
    }
  }
}

export default new Url(serviceConfigurations.url || {});
