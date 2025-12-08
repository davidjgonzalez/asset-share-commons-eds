import services from '../../scripts/asc/services/services.js';

export default async function decorate(block) {

    const assets = ['3e683243-7bee-40b4-8569-ba6652873f73', '5f905042-497f-42a2-91c1-09e12388ddcd', 'd63041dc-c557-49a3-986f-93a2c7f0a657'];
    const renditions = ['web', 'original'];

    const collections = services.collections.getCollections();

    const assetsQueryParameterValue = await services.url.compressArray(assets);
    const renditionsQueryParameterValue = await services.url.compressArray(renditions);

    block.innerHTML = `

    <h4>SHEET</h4>
    <a href="/sheets/download?assets=${assetsQueryParameterValue}&rendtions=${renditionsQueryParameterValue}">Goto sheet</a>


    <h4>Collections</h4>

    <ul>
        ${collections.map((collection) => `
            <li>${collection}</li>
        `).join('')}
    </ul>

    `;
    return block;
}