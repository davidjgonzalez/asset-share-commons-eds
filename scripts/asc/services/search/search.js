import serviceConfigurations from "../configurations.js";
import Asset from "../../models/asset.js";

const Events = {
  SEARCH_START: "asc:search",
  SEARCH_COMPLETE: "asc:search:complete",
  SEARCH_ERROR: "asc:search:error",
};

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
        this.executeSearchFromUrl(event.detail.value || window.location.search);
      } else {
        this.executeSearchFromFormData(event);
      }
    }); // end addEventListener for asc:search


    document.addEventListener("asc:blocks:loaded", (event) => { 
      this.executeSearchFromUrl(window.location.search);
    });
  }

  executeSearchFromUrl(queryParams) {
    const formId = this.getForm();
    const formData = new Map([
      ...this.collectFormData(formId),
      ...new Map(new URLSearchParams(queryParams)),
    ]);

    const cleanedData = this.cleanFormData(formData);

    this.search(cleanedData);
  }

  executeSearchFromFormData(event) {
    const formId = event.detail?.form || this.getForm();
    const formData = this.collectFormData(formId);

    if(event.detail?.type !== 'more') {
      formData.set('p.offset', '0');
    }

    const cleanedData = this.cleanFormData(formData);

    this.search(cleanedData);
  }

  getForm() {
    return this.form;
  }

  getBaseParams() {
    return {
      type: "dam:Asset",
      path: "/content/dam",
      orderby: "dam:created",
      mainasset: "true",
      "orderby.sort": "desc",
      "p.guessTotal": "true",
    };
  }

  collectFormData(formId) {
    const formData = new Map();

    // Find all inputs associated with the form
    const inputs = document.querySelectorAll(
      `[form="${formId}"], form#${formId}`
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
      const fieldset = this.getFieldset(name);

      console.log(name, value);
      if (name.startsWith('asc.')) {
        cleaned.set(name, value);
      } else if (fieldset) {
        // Check if there are supporting inputs for this predicate
        if (this.hasFieldsetSupport(fieldset, formData)) {
          console.log(
            "Add to cleaned; Has Valid Support -- name",
            name,
            "value",
            value
          );

          cleaned.set(name, value);
        }
      } else {
        // Check if this is a supporting field (has 'for' attribute)
        const input = document.querySelector(`[name="${CSS.escape(name)}"]`);
        const forAttribute = input?.getAttribute('for');
        
        if (forAttribute) {
          // This is a supporting field - only include if its fieldset is also in cleaned data
          const fieldsetHasValidInput = Array.from(formData.keys()).some(key => {
            const fieldsetInput = document.querySelector(`[name="${CSS.escape(key)}"]`);
            return fieldsetInput?.getAttribute('data-asc-fieldset') === forAttribute && 
                   !this.isEmpty(formData.get(key));
          });
          
          if (fieldsetHasValidInput) {
            //console.log("Add to cleaned; Supporting field with valid fieldset -- name", name, "value", value);
            cleaned.set(name, value);
          } else {
            //console.log("Skip; Supporting field without valid fieldset -- name", name, "value", value);
          }
        } else {
          // True standalone field, always include if not empty
          cleaned.set(name, value);
        }
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

  getFieldset(inputName) {
    const input = document.querySelector(`[name="${CSS.escape(inputName)}"]`);
    return input?.getAttribute("data-asc-fieldset") || null;
  }

  hasFieldsetSupport(fieldset, formData) {
    // Find inputs with for="${fieldset}" and check if they have values
    const supportingInputs = document.querySelectorAll(`[for="${CSS.escape(fieldset)}"]`);

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

  // Debounced search: only one search at a time, queue the latest request if needed
  _searchInProgress = false;

  async search(formData) {
    // If a search is already in progress, store the latest request and return
    if (this._searchInProgress) {
      return;
    }

    this._searchInProgress = true;

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
            type: formData.get("p.offset") === "0" ? "initial" : "more",
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
    } finally {
      this._searchInProgress = false;      
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
    url.searchParams.delete("p.offset");

    window.history.replaceState({}, "", url);
  }

  async getAssetByPath(path) {
    const searchUrl = services.aem.getUrl("/bin/querybuilder.json");
    const params = new URLSearchParams({
      type: "dam:Asset",
      path: path,
      "p.limit": "1",
      "p.hits": "full",
      "p.nodedepth": "5",
    });

    const response = await fetch(`${searchUrl}?${params}`);
    const data = await response.json();

    return data.hits?.length > 0 ? new Asset(data.hits[0]) : null;
  }

  async getAssetById(id) {
    const searchUrl = services.aem.getUrl("/bin/querybuilder.json");
    const params = new URLSearchParams({
      type: "dam:Asset",
      property: "jcr:uuid",
      "property.value": id,
      "p.limit": "1",
      "p.hits": "full",
      "p.nodedepth": "5",
    });

    const response = await fetch(`${searchUrl}?${params}`);
    const data = await response.json();

    return data.hits?.length > 0 ? new Asset(data.hits[0]) : null;
  }
}

export default new SearchService(serviceConfigurations.search);
