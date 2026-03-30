// ASC Core — do not edit. Customize via scripts/configurations.js
import serviceConfigurations from "../configurations.js";

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

  // 2. Decompress back into an array of values
  async decompressToArray(encoded) {
    if (!encoded) {
      return [];
    }

    const bytes = this.fromBase64Url(encoded);

    const ds = new DecompressionStream("deflate");
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();

    const decompressed = await new Response(ds.readable).arrayBuffer();
    const text = new TextDecoder().decode(decompressed);
    return text.split(","); // Split back into array
  }
}

export default new Url(serviceConfigurations.url);
