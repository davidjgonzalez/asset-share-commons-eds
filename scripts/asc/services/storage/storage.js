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

  ACTIVE_COLLECTION_ID = "activeCollectionId";

  RECENTLY_VIEWED = "recentlyViewed";

  THEME = "theme";

  SHARED_LINKS = "sharedLinks";

  RECENTLY_VIEWED_MAX = 50;

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

  /**
   * Prepends a UUID to the current user's recently viewed list, deduplicates,
   * and caps the list at RECENTLY_VIEWED_MAX entries.
   * @param {string} uuid - The asset UUID to record.
   */
  addRecentlyViewed(uuid) {
    const existing = this.getRecentlyViewed().filter((id) => id !== uuid);
    const updated = [uuid, ...existing].slice(0, this.RECENTLY_VIEWED_MAX);
    this.set(this.RECENTLY_VIEWED, updated);
  }

  /**
   * Returns the current user's recently viewed asset UUID list.
   * @returns {string[]}
   */
  getRecentlyViewed() {
    return this.get(this.RECENTLY_VIEWED) || [];
  }

  /**
   * Returns the globally stored theme name.
   * @returns {string|null}
   */
  getTheme() {
    return this.getGlobal(this.THEME) || null;
  }

  /**
   * Stores the theme name globally.
   * @param {string} name - The theme name to persist.
   */
  setTheme(name) {
    this.setGlobal(this.THEME, name);
  }

  /**
   * Prepends a shared link entry to the global sharedLinks array, deduplicating
   * by URL. Each entry contains { url, label, receivedAt } (ISO timestamp).
   * @param {string} url - The shared link URL.
   * @param {string|null} [label=null] - Optional human-readable label.
   */
  addSharedLink(url, label = null) {
    const existing = this.getSharedLinks().filter((entry) => entry.url !== url);
    const entry = { url, label, receivedAt: new Date().toISOString() };
    this.setGlobal(this.SHARED_LINKS, [entry, ...existing]);
  }

  /**
   * Returns the global shared links array.
   * @returns {Array<{url: string, label: string|null, receivedAt: string}>}
   */
  getSharedLinks() {
    return this.getGlobal(this.SHARED_LINKS) || [];
  }

  /**
   * Listens to cross-tab/window storage events for any ASC-namespaced key
   * (keys starting with `${ROOT}:`). Calls callback with the StorageEvent.
   * @param {function(StorageEvent): void} callback
   */
  onExternalChange(callback) {
    window.addEventListener("storage", (event) => {
      if (event.key && event.key.startsWith(`${ROOT}:`)) {
        callback(event);
      }
    });
  }

  /**
   * Merges the RECENTLY_VIEWED list from one user into another user's list.
   * The result is deduplicated and capped at RECENTLY_VIEWED_MAX.
   * Does NOT merge collections — that is handled by the collections service.
   * @param {string} fromUserId - The user ID to merge from.
   * @param {string} toUserId - The user ID to merge into.
   */
  mergeUserData(fromUserId, toUserId) {
    const fromData = this._getUserData(fromUserId) || {};
    const fromViewed = fromData[this.RECENTLY_VIEWED] || [];

    const toData = this._getUserData(toUserId) || {};
    const toViewed = toData[this.RECENTLY_VIEWED] || [];

    const merged = [...toViewed];
    fromViewed.forEach((uuid) => {
      if (!merged.includes(uuid)) {
        merged.push(uuid);
      }
    });

    toData[this.RECENTLY_VIEWED] = merged.slice(0, this.RECENTLY_VIEWED_MAX);
    this._setUserData(toUserId, toData);
  }
}

export default new Storage(serviceConfigurations.storage || {});
