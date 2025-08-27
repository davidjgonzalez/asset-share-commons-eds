import serviceConfigurations from "../configurations.js";
import Asset from "../../models/asset.js";

class SearchService {
  constructor(config) {
    this.config = config;
    this.form = this.config.form || "asc-search-form";
    this.searchUrl = config.url;
    this.init();
  }

  init() {
    document.addEventListener("asc:search", (event) => {
      if (event.detail?.source === "query-params") {
        this.executeSearchFromUrl(event.detail.value || "");
      } else {
        this.executeSearchFromFormData(event);
      }
    });

    if(document.querySelector(".block.search-results")) {
      const interval = setInterval(() => {
        // check to make sure that all .block are marked as data-block-status="loaded"
        const blocks = document.querySelectorAll(".block");
        const loadedBlocks = Array.from(blocks).filter(
          (block) => block.getAttribute("data-block-status") === "loaded"
        );

        if (loadedBlocks.length === blocks.length) {
          clearInterval(interval);
          this.executeSearchFromFormData({
            detail: {
              formId: this.getForm(),
              source: "page-load",
            },
          });
        }
      }, 100);
    }
  }

  executeSearchFromUrl(queryParams) {
    const formData = new Map(new URLSearchParams(queryParams));
    const cleanedData = this.cleanFormData(formData);

    this.submitSearch(cleanedData);
  }

  executeSearchFromFormData(event) {
    const formId = event.detail?.form || this.getForm();
    const formData = this.collectFormData(formId);
    const cleanedData = this.cleanFormData(formData);

    this.submitSearch(cleanedData);
  }

  getForm() {
    return this.form;
  }

  getBaseParams() {
    return {
      type: "dam:Asset",
      path: "/content/dam",
      orderby: "dam:created",
      "orderby.sort": "desc",
      "p.limit": 25,
    };
  }

  collectFormData(formId) {
    const formData = new Map();

    // Find all inputs associated with the form
    const inputs = document.querySelectorAll(
      `[form="${formId}"], form#${formId} input, form#${formId} select, form#${formId} textarea`
    );

    inputs.forEach((input) => {
      const name = input.name;
      const value = this.getInputValue(input);

      if (name && value !== "") {
        // Handle multiple values for same name (like checkboxes)
        if (formData.has(name)) {
          const existing = formData.get(name);
          if (Array.isArray(existing)) {
            existing.push(value);
          } else {
            formData.set(name, [existing, value]);
          }
        } else {
          formData.set(name, value);
        }
      }
    });

    return formData;
  }

  getInputValue(input) {
    const type = input.type?.toLowerCase();

    switch (type) {
      case "checkbox":
      case "radio":
        return input.checked ? input.value : "";
      case "select-multiple":
        return Array.from(input.selectedOptions)
          .map((option) => option.value)
          .filter((v) => v);
      default:
        return input.value?.trim() || "";
    }
  }

  cleanFormData(formData) {
    const cleaned = new Map();

    formData.forEach((value, name) => {
      // Skip empty values
      if (this.isEmpty(value)) {
        return;
      }

      // Handle predicate-based cleaning
      const predicateId = this.getPredicateId(name);
      if (predicateId) {
        // Check if there are supporting inputs for this predicate
        if (this.hasValidPredicateSupport(predicateId, formData)) {
          cleaned.set(name, value);
        }
      } else {
        // Standalone field, always include if not empty
        cleaned.set(name, value);
      }
    });

    return cleaned;
  }

  isEmpty(value) {
    if (Array.isArray(value)) {
      return value.length === 0 || value.every((v) => v === "");
    }
    return value === "" || value == null;
  }

  getPredicateId(inputName) {
    const input = document.querySelector(`[name="${inputName}"]`);
    return input?.getAttribute("data-asc-filter") || null;
  }

  hasValidPredicateSupport(predicateId, formData) {
    // Find inputs with for="${predicateId}" and check if they have values
    const supportingInputs = document.querySelectorAll(
      `[for="${predicateId}"]`
    );

    for (const supportingInput of supportingInputs) {
      const supportingName = supportingInput.name;
      const supportingValue = formData.get(supportingName);

      if (!this.isEmpty(supportingValue)) {
        return true;
      }
    }

    return supportingInputs.length === 0; // No supporting inputs means it's standalone
  }

  adjustFormData(formData) {
    const adjusted = new Map(formData);

    // Handle date range upperBounds
    adjusted.forEach((value, name) => {
      if (
        name.endsWith("daterange.upperBound") &&
        typeof value === "string" &&
        !value.endsWith("T23:59:59.999Z")
      ) {
        adjusted.set(name, value + "T23:59:59.999Z");
      }
    });

    return adjusted;
  }

  async submitSearch(formData) {
    try {
      // Emit search start event
      document.dispatchEvent(
        new CustomEvent("asc:search:start", {
          detail: { formData: new Map(formData) },
        })
      );

      // Convert formData (Map) and base params (object) into a single object of query param names and values
      formData = new Map([
        ...Object.entries(this.getBaseParams()),
        ...formData,
      ]);

      const adjustedData = this.adjustFormData(formData);

      adjustedData.set("p.hits", this.config.hits || "full");
      if (this.config.hits === "selective") {
        adjustedData.set("p.properties", this.config.properties.join(" "));
      } else {
        adjustedData.set("p.nodedepth", "5");
      }

      const queryParams = this.buildQueryParams(adjustedData);
      const searchUrl = `${this.searchUrl}?${queryParams}`;

      // Config Hook: Pre process the query
      const preprocessedQuery = this.config.preprocessQuery
        ? this.config.preprocessQuery(queryParams)
        : queryParams;

      // Update browser URL
      this.updateBrowserUrl(queryParams);

      // Perform the search
      const response = await fetch(searchUrl);
      const qbResults = await response.json();

      const results = {
        ...qbResults,
        assets: qbResults.hits.map((hit) => new Asset(hit)),
      };

      delete results.hits;

      // Config Hook: Post process the results
      const processedResults = this.config.postprocessResults
        ? this.config.postprocessResults(results)
        : results;

      // Emit search complete event
      document.dispatchEvent(
        new CustomEvent("asc:search:complete", {
          detail: {
            results: processedResults,
            query: queryParams,
            formData: new Map(formData),
          },
        })
      );
    } catch (error) {
      console.error("Search failed:", error);

      // Emit search error event
      document.dispatchEvent(
        new CustomEvent("asc:search:error", {
          detail: { error, formData: new Map(formData) },
        })
      );
    }
  }

  buildQueryParams(formData) {
    const params = new URLSearchParams();

    formData.forEach((value, name) => {
      if (Array.isArray(value)) {
        value.forEach((v) => params.append(name, v));
      } else {
        params.append(name, value);
      }
    });

    return params.toString();
  }

  updateBrowserUrl(queryParams) {
    const url = new URL(window.location);

    url.search = "";

    // Add new params
    const newParams = new URLSearchParams(queryParams);
    newParams.forEach((value, key) => {
      url.searchParams.append(key, value);
    });

    window.history.replaceState({}, "", url);
  }

  async getAssetByPath(path) {
    const searchUrl = services.aem.getUrl('/bin/querybuilder.json');
    const params = new URLSearchParams({
      'type': 'dam:Asset',
      'path': path,
      'p.limit': '1',
      'p.hits': 'full',
      'p.nodedepth': '5'
    });

    const response = await fetch(`${searchUrl}?${params}`);
    const data = await response.json();

    return data.hits?.length > 0 ? new Asset(data.hits[0]) : null;
  }

  async getAssetById(id) {
      const searchUrl = services.aem.getUrl('/bin/querybuilder.json');
      const params = new URLSearchParams({
          'type': 'dam:Asset',
          'property': 'jcr:uuid',
          'property.value': id,
          'p.limit': '1',
          'p.hits': 'full',
          'p.nodedepth': '5'
      });

      const response = await fetch(`${searchUrl}?${params}`);
      const data = await response.json();

      return data.hits?.length > 0 ? new Asset(data.hits[0]) : null;
  }
}

export default new SearchService(serviceConfigurations.search);
