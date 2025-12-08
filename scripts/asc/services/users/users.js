import serviceConfigurations from "../configurations.js";
import storage from '../storage/storage.js';

export const ANONYMOUS = 'anonymous';


class Users {
    constructor(config) {
        this.config = config || {};
    }

    getCurrentUser() {
        storage.getCurrentUser();
    }
}

export default new Users(serviceConfigurations.users);