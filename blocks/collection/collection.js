import services from "../../scripts/asc/services/services.js";
import AssetTeaser from "../../scripts/asc/parts/asset-teaser/asset-teaser.js";
import { replaceTokens } from "../../scripts/asc/utils/blocks.js";

export default async function decorate(block) {
  const collection = await services.collections.getCollection("cart");

  block.innerHTML = html(block, collection);

  replaceTokens(document.body, "collection-name", "Cart");
}

function html(block, collection) {
  return `
    <div class="collection">
    
      <h1>${collection.id}</h1>

      <div class="cards">
        ${collection.assets.map((asset) => new AssetTeaser({ block, asset }).html()).join("")}
      </div>

    </div>
  `;
}
