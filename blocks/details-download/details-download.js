import { readBlockConfig } from "../../scripts/aem.js";
import Asset from "../../scripts/asc/models/asset.js";

export default async function decorate(block) {
  const config =  {
    label: 'Download',
    ...readBlockConfig(block)
  }
  const asset = await Asset.create(block);

  block.innerHTML = `
      <label>${config.label}</label>

      <ul>
        ${asset.renditions.map((rendition) => `
          <li>
            <a href="${rendition.url}" download="${asset.title}">
              ${rendition.id}
            </a>
          </li>
        `).join('')}
      </ul>
    `;
}
