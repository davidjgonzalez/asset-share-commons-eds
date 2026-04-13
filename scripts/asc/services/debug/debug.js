// ASC Core — do not edit. Customize via scripts/configurations.js
import serviceConfigurations from '../configurations.js';

class Debug {
  constructor(config) {
    this.debug = config.debug;
  }

  setDebug(debug) {
    this.debug = debug;
  }

  formFields(block) {
    block.querySelectorAll("input, select, textarea").forEach((input) => {
      console.debug(
        input.name,
        "=",
        input.value,
        "|",
        input.type,
        "|",
        input.getAttribute("form")
      );
    });
  }
}

export default new Debug(serviceConfigurations.debug || {});
