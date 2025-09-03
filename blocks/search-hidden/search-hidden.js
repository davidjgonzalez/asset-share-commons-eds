/**
 * AEM QueryBuilder documentation - Path
 * https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/full-stack/search/query-builder-predicates#path
 **/

import {
  SEARCH_FORM,
  getGroup,
  getFieldName,
} from "../../scripts/asc/utils/search.js";

export default function decorate(block) {
  const config = {
    form: SEARCH_FORM,
    group: getGroup(block),
    fields: [],
  };

  // Search - Hidden is a special case and does not share the typical block config
  config.fields = [...block.querySelectorAll(":scope > div")].map((row) => {
    const cells = row.querySelectorAll("div");

    if (cells.length === 2) {
      const key = getFieldName({
        group: config.group,
        name: cells[0].textContent.trim().toLowerCase(),
      });
      const value = cells[1].textContent.trim();

      return {
        [key]: value,
      };
    }
  });

  block.innerHTML = html(config);
}

function html(config) {
  return config.fields
    .map((field) => {
      return `<input type="hidden"
                    name="${Object.keys(field)[0]}" 
                    value="${Object.values(field)[0]}" 
                    form="${config.form}"/>`;
    })
    .join("\n");
}
