// ASC Core — do not edit. Customize via scripts/configurations.js
import serviceConfigurations from "../configurations.js";

class Actions {
  constructor(config) {
    this.config = config = {};
    this.actions = [];
    this.init();
  }

  init() {
    this.initActionHandler();
  }

  initActionHandler() {
    const ASC_EVENT_PREFIX = "asc";
    const DEFAULT_EVENT = "click";
    const EVENTS = ["click", "submit", "change", "input", "mouseover", "mouseout", "keydown", "mouseenter", "mouseleave", "load", "DOMContentLoaded"];

    function collectData(el) {
      const data = {};
      let node = el;
      while (node && node !== document) {
        if (node.dataset) Object.assign(data, node.dataset);
        node = node.parentElement;
      }
      return data;
    }

    function parseActions(attr) {
      return attr.split(/\s+/).map((token) => {
        const [name, event = DEFAULT_EVENT] = token.split("@");
        return { name, event };
      });
    }

    function handleEvent(event) {
      let node = event.target;

      while (node && node !== document) {
        const attr = node.dataset?.ascAction;
        if (attr) {
          const actions = parseActions(attr);
          const ctx = {
            el: node,
            event,
            data: collectData(node),
            stop: false,
          };

          for (const action of actions) {
            if (action.event !== event.type) continue;

            const customEvent = new CustomEvent(`${ASC_EVENT_PREFIX}:${action.name}`, {
              bubbles: true,
              detail: ctx,
            });

            node.dispatchEvent(customEvent);

            if (ctx.stop) return;
          }
        }

        node = node.parentElement;
      }
    }

    EVENTS.forEach((type) => document.addEventListener(type, handleEvent));
  }
}

export default new Actions(serviceConfigurations.actions);
