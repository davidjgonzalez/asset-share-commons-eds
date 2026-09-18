// ASC Core — do not edit. Customize via scripts/asc/configurations.js
/**
 * WebMCP service — registers ASC capabilities as tools callable by an
 * in-browser AI agent via the emerging WebMCP standard
 * (`document.modelContext.registerTool`, shipping behind Chrome's origin
 * trial as of Chrome 149; unsupported browsers simply get a no-op here).
 *
 * Built-in tools are read-only lookups against existing services — no new
 * business logic, just a JSON-serializing wrapper around `search`,
 * `renditions`, and `Asset`. Which tools are registered is a plain array
 * (BUILT_IN_TOOLS below), same shape as `LISTENERS` in the notifications/
 * activity services. Add your own (e.g. a future "create sheet" or "add to
 * collection" tool) without editing this file via configurations.js →
 * webmcp.customTools — an array of tool definitions merged in at init time.
 *
 * Configure enabled/customTools in configurations.js → webmcp. Auto-
 * initializes on import, like every other core service.
 */
import serviceConfigurations from '../configurations.js';
import search from '../search/search.js';
import renditions from '../renditions/renditions.js';

const toAssetSummary = (asset) => ({
  id: asset.uuid,
  title: asset.title,
  description: asset.description,
  mimeType: asset.mimeType,
  path: asset.path,
});

const toAssetDetail = (asset) => ({
  ...toAssetSummary(asset),
  filename: asset.filename,
  sizeInBytes: asset.sizeInBytes,
  created: asset.created,
  lastModified: asset.lastModified,
});

const toRenditionSummary = (r) => ({
  id: r.id,
  label: r.label,
  url: r.url,
  mimeType: r.mimeType,
  width: r.width,
  height: r.height,
  fileSize: r.fileSize,
});

class WebMcp {
  constructor(config) {
    this.config = config || {};
    this.registered = [];
    this.init();
  }

  init() {
    if (this.config.enabled === false) return;
    if (!document.modelContext?.registerTool) return; // unsupported browser — no-op
    this.registerTools();
  }

  builtInTools() {
    return [
      {
        name: 'asc_assets_search',
        description: 'Search the asset library. Returns matching assets with id, title, description, mimeType, and path.',
        annotations: { readOnlyHint: true },
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Free-text search across title, description, and content' },
            path: { type: 'string', description: 'Restrict results to this DAM folder path' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Tag IDs to filter by' },
            dateFrom: { type: 'string', description: 'ISO date — only assets created/modified on or after this date' },
            dateTo: { type: 'string', description: 'ISO date — only assets created/modified on or before this date' },
            limit: { type: 'number', description: 'Max number of results (default 20)' },
          },
        },
        execute: async ({ query, path, tags, dateFrom, dateTo, limit } = {}) => {
          const formData = new Map();
          if (query) formData.set('fulltext', query);
          if (path) formData.set('path', path);
          if (tags?.length) formData.set('1_tagid', tags);
          if (dateFrom) formData.set('daterange.lowerBound', dateFrom);
          if (dateTo) formData.set('daterange.upperBound', dateTo);
          formData.set('p.limit', String(limit || 20));

          const results = await search.searchSilent(formData);
          return JSON.stringify({
            total: results.total,
            assets: results.assets.map(toAssetSummary),
          });
        },
      },
      {
        name: 'asc_assets_get',
        description: 'Fetch full metadata for a single asset by ID (UUID).',
        annotations: { readOnlyHint: true },
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Asset UUID' },
          },
          required: ['id'],
        },
        execute: async ({ id }) => {
          const asset = await search.getAssetById(id);
          if (!asset) return JSON.stringify({ error: `Asset not found: ${id}` });
          return JSON.stringify(toAssetDetail(asset));
        },
      },
      {
        name: 'asc_assets_renditions',
        description: 'List available renditions (thumbnail, web, original, etc.) with resolved URLs for a single asset by ID.',
        annotations: { readOnlyHint: true },
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Asset UUID' },
          },
          required: ['id'],
        },
        execute: async ({ id }) => {
          const asset = await search.getAssetById(id);
          if (!asset) return JSON.stringify({ error: `Asset not found: ${id}` });
          const list = renditions.getRenditions(asset).filter((r) => r.visible !== false);
          return JSON.stringify(list.map(toRenditionSummary));
        },
      },
    ];
  }

  registerTools() {
    [...this.builtInTools(), ...(this.config.customTools || [])].forEach((tool) => {
      document.modelContext.registerTool(tool);
      this.registered.push(tool.name);
    });
  }
}

export default new WebMcp(serviceConfigurations.webmcp);
