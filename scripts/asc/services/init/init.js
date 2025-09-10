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
    const interval = setInterval(() => {
      // check to make sure that all .block are marked as data-block-status="loaded"
      const blocks = document.querySelectorAll("main .block");
      const loadedBlocks = Array.from(blocks).filter(
        (block) => block.getAttribute("data-block-status") === "loaded"
      );

      if (loadedBlocks.length === blocks.length) {
        clearInterval(interval);
        document.dispatchEvent(
          new CustomEvent("asc:blocks:loaded", {
            detail: { blocks: loadedBlocks },
          })
        );
      }
    }, 10);

    /**
     * Preload URLs on hover
     */
    if (this.config.preload) {
      delegateEvent(document.body, '[data-asc-preload]', 'mouseover', (event) => { 
        if (event.target.dataset.ascPreload) {
          fetch(event.target.dataset.ascPreload);
        }
      });   
    }
  }
}

export default new Init(serviceConfigurations.init);