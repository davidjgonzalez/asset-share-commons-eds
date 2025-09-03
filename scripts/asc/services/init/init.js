import serviceConfigurations from "../configurations.js";

class Init {
  constructor(config) {
    this.config = config;

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
            detail: { blocks: blocks },
          })
        );
      }
    }, 50);
  }
}


export default new Init(serviceConfigurations.init);