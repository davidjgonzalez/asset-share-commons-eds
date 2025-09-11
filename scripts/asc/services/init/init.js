import serviceConfigurations from "../configurations.js";
import { delegateEvent } from "../../utils/events.js";
class Init {
  constructor(config) {
    this.config = config;

    window.asc = {
      cache: {
        assets: new Map(),
      }
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

        if (loadedBlocks.length === blocks.length) {
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
      delegateEvent(document.body, '[data-asc-preload]', 'mouseover', (event) => { 
        fetch(event.target.dataset.ascPreload);
      });   

      delegateEvent(document.body, '[data-asc-preload-fragment]', 'mouseover', (event) => { 
          const url = new URL(event.target.dataset.ascPreloadFragment, window.location);
          url.pathname = `${url.pathname}.plain.html`;
          fetch(`${url.pathname}`);
      });  
    }
  }
}

export default new Init(serviceConfigurations.init);