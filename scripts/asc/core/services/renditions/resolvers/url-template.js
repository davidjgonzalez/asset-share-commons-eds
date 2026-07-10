// ASC Core — do not edit. Customize via scripts/asc/configurations.js
import Rendition from '../../../models/rendition.js';

export default {
  type: 'url-template',

  fromDefinition(def, asset) {
    if (typeof def.template !== 'string') {
      console.warn(`[ASC] Rendition "${def.id}" has type "url-template" but template is not a string.`);
      return null;
    }

    const vars = {
      'asset.path': asset.path,
      'asset.name': asset.filename,
      'asset.extension': asset.fileExtension,
      'rendition.name': def.id,
      'dm.name': asset.getProperty('dam:scene7Name').data,
      'dm.id': asset.getProperty('dam:scene7ID').data,
      'dm.file': asset.getProperty('dam:scene7File').data,
      'dm.folder': asset.getProperty('dam:scene7Folder').data,
      'dm.domain': asset.getProperty('dam:scene7Domain').data,
      'dm.api-server': asset.getProperty('dam:scene7APIServer').data,
    };

    let missingVar = false;
    const url = def.template.replace(/\$\{([^}]+)\}/g, (_, key) => {
      const k = key.trim();
      if (!(k in vars)) {
        console.warn(`[ASC] Unknown url-template variable "\${${k}}" in rendition "${def.id}"`);
        return '';
      }
      const val = vars[k];
      if (val == null || val === '') { missingVar = true; return ''; }
      return String(val);
    });

    if (missingVar || !url) return null;

    return new Rendition({
      id: def.id,
      label: def.label,
      description: def.description ?? null,
      visible: def.visible ?? true,
      mimeType: def.mimeType ?? null,
      width: def.width ?? null,
      height: def.height ?? null,
      usecase: def.usecase ?? null,
      url,
    });
  },
};
