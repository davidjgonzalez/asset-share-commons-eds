import services from '../../scripts/asc/services/services.js';
import Asset from '../../scripts/asc/models/asset.js';

export default async function decorate(block) {
    const { assets, renditions } = await getDataFromSearchParams(new URLSearchParams(window.location.search));

    console.log('assets', assets);
    console.log('renditions', renditions);

    
    block.innerHTML = `

        ${assets.map((asset) => `
            <h2>${asset.title}</h2>
        `).join('')}

        ${renditions.map((rendition) => `
            <h2>${rendition.name}</h2>
        `).join('')}
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
    const renditions = await Promise.all(renditionIds.map(async (id) => await Rendition.create(id)));

    console.log('assets', assets);
    console.log('renditions', renditions);

    return { assets, renditions };


}