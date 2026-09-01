// ASC Core — do not edit. Customize via scripts/asc/configurations.js
import serviceConfigurations from "../configurations.js";
import { delegateEvent } from "../../utils/events.js";

class Init {
  constructor(config) {
    this.config = config || {};
    this.preloads = new Map();

    window.asc = {
      cache: {
        assets: new Map(),
      },
    };

    /**
     * Emit an event when all blocks are loaded
     */
    (async () => {
      while (true) {
        // Check to make sure that all .block are marked as data-block-status="loaded"
        const blocks = document.querySelectorAll("main .block");
        const loadedBlocks = Array.from(blocks).filter(
          (block) => block.getAttribute("data-block-status") === "loaded"
        );

        if (blocks.length > 0 && loadedBlocks.length === blocks.length) {
          document.dispatchEvent(
            new CustomEvent("asc:blocks:loaded", {
              detail: { blocks: loadedBlocks },
            })
          );
          break;
        }
        // Wait for next check, serially
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    })();

    /**
     * Preload URLs on hover
     */
    if (this.config.preload) {

        document.body.addEventListener("asc:asset:preload", (event) => {
          const { ascPreload } = event.target.dataset;

          if (!ascPreload || this.preloads[ascPreload]) {
            // Already preloaded; don't bother doing it again
            return;
          }

          this.preloads[ascPreload] = true;

          fetch(ascPreload);
          if (!ascPreload.includes('.')) {
            // Try direct path first; fall back to /index variant for folder-index pages
            fetch(`${ascPreload}.plain.html`).then((r) => {
              if (!r.ok && !ascPreload.endsWith('/index')) {
                fetch(`${ascPreload}/index.plain.html`);
              }
            });
          }
        });
    }
  }
}

export default new Init(serviceConfigurations.init || {});
