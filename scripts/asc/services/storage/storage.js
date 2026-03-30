// ASC Core — do not edit. Customize via scripts/configurations.js
import serviceConfigurations from "../configurations.js";
import users from "../users/users.js";

const ROOT = "asc";
const ANONYMOUS = "anonymous";
const CURRENT_USER_ID = `currentUserId`;


/**
 * Storage class for managing localStorage with user scoping.
 * Each user's data is isolated by prefixing keys with a user identifier.
 *
 * There are 2+ keys in local storage, all ASC related keys are prefixed with ${ROOT}.
 *
 * - asc = {
 *    currentUserId: 'anonymous',
 *    globalSetting1: 'value1',
 *    globalSetting2: { 'key1': 'value1', 'key2': 'value2' },
 *    ...
 * }
 *
 * - asc:anonymous = {
 *    user {
 *      userId: 'anonymous',
 *      userSetting1: 'value1',
 *      userSetting2: { 'key1': 'value1', 'key2': 'value2' },
 *      ...
 *    },
 *    collections: []
 *    ...
 * }
 *
 * -asc:user1 = {
 *    user {
 *      userId: 'user1',
 *      userSetting1: 'value1',
 *      userSetting2: { 'key1': 'value1', 'key2': 'value2' },
 *    },
 *    collections: []
 *    ...
 * }
 */
class Storage {
  COLLECTIONS = "collections";

  /**
   * @param {Object} config - Configuration object.
   * @param {string} [config.userId] - Unique identifier for the current user.
   */
  constructor(config) {
    this.config = config || {};
    this.storage = localStorage;
    this.init();
  }

  init() {
    // Initialize global storage if it doesn't exist
    if (!this._getGlobalData()) {
      this._setGlobalData({
        currentUserId: ANONYMOUS,
      });
    }

    // Initialize current user storage if it doesn't exist
    const userId = this._getCurrentUserId();
    if (!this._getUserData(userId)) {
      this._setUserData(userId, {
        user: {
          userId: userId,
        },
      });
    }
  }

  /**
   * Gets global ASC data (not user-specific).
   * @returns {Object}
   */
  _getGlobalData() {
    const data = this.storage.getItem(ROOT);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Sets global ASC data (not user-specific).
   * @param {Object} data
   */
  _setGlobalData(data) {
    this.storage.setItem(ROOT, JSON.stringify(data));
  }

  /**
   * Gets user-specific data.
   * @param {string} userId
   * @returns {Object}
   */
  _getUserData(userId) {
    const key = `${ROOT}:${userId}`;
    const data = this.storage.getItem(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Sets user-specific data.
   * @param {string} userId
   * @param {Object} data
   */
  _setUserData(userId, data) {
    const key = `${ROOT}:${userId}`;
    this.storage.setItem(key, JSON.stringify(data));
  }

  /**
   * Gets the current user ID from global storage.
   * @returns {string}
   */
  _getCurrentUserId() {
    const globalData = this._getGlobalData();
    return globalData?.currentUserId || ANONYMOUS;
  }

  /**
   * Sets the current user ID in global storage.
   * @param {string} userId
   */
  _setCurrentUserId(userId) {
    if (!userId) {
      userId = ANONYMOUS;
    }

    const globalData = this._getGlobalData() || {};
    globalData.currentUserId = userId;
    this._setGlobalData(globalData);

    // Initialize user data if it doesn't exist
    if (!this._getUserData(userId)) {
      this._setUserData(userId, {
        user: {
          userId: userId,
        },
      });
    }
  }

  /**
   * Gets a value from user-scoped storage.
   * @param {string} key - The key to retrieve (e.g., 'collections', 'user')
   * @returns {*} - The value, or null if not found
   */
  get(key) {
    const userId = this._getCurrentUserId();
    const userData = this._getUserData(userId);
    return userData ? userData[key] : null;
  }

  /**
   * Sets a value in user-scoped storage.
   * @param {string} key - The key to set (e.g., 'collections', 'user')
   * @param {*} value - The value to store
   */
  set(key, value) {
    const userId = this._getCurrentUserId();
    const userData = this._getUserData(userId) || {};
    userData[key] = value;
    this._setUserData(userId, userData);
  }

  /**
   * Removes a value from user-scoped storage.
   * @param {string} key - The key to remove
   */
  remove(key) {
    const userId = this._getCurrentUserId();
    const userData = this._getUserData(userId);
    if (userData && key in userData) {
      delete userData[key];
      this._setUserData(userId, userData);
    }
  }

  /**
   * Gets a global setting (not user-specific).
   * @param {string} key - The key to retrieve
   * @returns {*} - The value, or null if not found
   */
  getGlobal(key) {
    const globalData = this._getGlobalData();
    return globalData ? globalData[key] : null;
  }

  /**
   * Sets a global setting (not user-specific).
   * @param {string} key - The key to set
   * @param {*} value - The value to store
   */
  setGlobal(key, value) {
    const globalData = this._getGlobalData() || {};
    globalData[key] = value;
    this._setGlobalData(globalData);
  }

  /**
   * Removes a global setting.
   * @param {string} key - The key to remove
   */
  removeGlobal(key) {
    const globalData = this._getGlobalData();
    if (globalData && key in globalData) {
      delete globalData[key];
      this._setGlobalData(globalData);
    }
  }
}

export default new Storage(serviceConfigurations.storage);
