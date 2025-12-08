import serviceConfigurations from "../configurations.js";
import { delegateEvent } from "../../utils/events.js";

class Actions {
    constructor(config) {
        this.config = config = {};
        this.actions = [];
        this.init();
    }

    init() {
    }

    registerAction(actionName, eventType, handler) {
        const removeListener = delegateEvent(document.body, `[data-asc-action~="${actionName}"]`, eventType, handler);
        this.actions.push({ actionName, eventType, handler, removeListener });
    }
    
    unregisterAction(actionName, eventType) {
        const action = this.actions.find(a => a.actionName === actionName && a.eventType === eventType);
        if (action && action.removeListener) {
            action.removeListener();
        }
        this.actions = this.actions.filter(action => action.actionName !== actionName || action.eventType !== eventType);
    }
}

export default new Actions(serviceConfigurations.actions);

