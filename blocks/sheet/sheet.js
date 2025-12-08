import services from '../../scripts/asc/services/services.js';
import Asset from '../../scripts/asc/models/asset.js';
import Rendition from '../../scripts/asc/models/rendition.js';

export default async function decorate(block) {
    const { assets, renditionDefinitions } = await getDataFromSearchParams(new URLSearchParams(window.location.search));

    console.log('assets', assets);
    console.log('renditionDefinitions', renditionDefinitions);

    
    block.innerHTML = `
    <a href="/">Back to search</a>
    

    <h1>Sheet</h1>

    <div class="renditions">
        <h3>Renditions</h3>
        ${renditionDefinitions.map((rendition) => `
            <h4>${rendition.label}</h4>
            <p>${rendition.description}</p>
        `).join('')}
    </div>

        <hr/>

        <h3>Assets</h3>
    <div class="assets">
        ${assets.map((asset) => `
            <div class="asset">
            ${asset.getPictureHtml({
                breakpoints: [
                    { renditionWidth: 319, width: 0 },
                    { renditionWidth: 560, width: 768 },
                    { renditionWidth: 840, width: 1024 },
                ],
                sizes: "(max-width: 768px) 250px, (max-width: 1024px) 280px, 280px",
                loading: "eager",
                alt: asset.title
            })}
                <h2>${asset.title}</h2>
            </div>
        `).join('')}
        </div>

    `;

    return block;
}


async function getDataFromSearchParams(queryParameters) {

    const assetsCompressed = queryParameters.get('assets');
    const renditionsCompressed = queryParameters.get('renditions');

    console.log('assetsCompressed', assetsCompressed);
    console.log('renditionsCompressed', renditionsCompressed);

    const assetIds = await services.url.decompressToArray(assetsCompressed);
    const renditionIds = await services.url.decompressToArray(renditionsCompressed);


    console.log('assetIds', assetIds);
    console.log('renditionIds', renditionIds);

    const assets = await Promise.all(assetIds.map(async (id) => await Asset.create(id)));
    const renditionDefinitions = renditionIds.map((id) => services.renditions.getRenditionDefinition(id));

    console.log('assets', assets);
    console.log('renditionDefinitions', renditionDefinitions);

    return { assets, renditionDefinitions };


}