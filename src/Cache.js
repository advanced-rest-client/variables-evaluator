/**
 * In-memory cache store for evaluated values.
 *
 * @module variables-evaluator/Cache
 */

const cache = new WeakMap();

/**
 * Removes cached values from the store.
 * @param {Object} target The cache target, element or object extending the mixin
 */
export const clear = target => {
  if (cache.has(target)) {
    cache.delete(target);
  }
};

/**
 * Finds cached group.
 *
 * @param {Object} target The cache target, element or object extending the mixin
 * @param {String} key A key where a function keeps cached objects
 * @param {String} group Group name. Defined by user as an argument.
 * @return {string|number|null} Cached value.
 */
export const find = (target, key, group) => {
  const value = cache.get(target);
  if (!value) {
    return null;
  }
  if (!value[key]) {
    return null;
  }
  return value[key][group];
};

/**
 * Stores value in cache.
 *
 * @param {Object} target The cache target, element or object extending the mixin
 * @param {String} key A key where a function keeps cached objects
 * @param {String} group Group name. Defined by user as an argument.
 * @param {string|number} value Cached value.
 */
export const store = (target, key, group, value) => {
  let cacheValue = cache.get(target);
  if (!cacheValue) {
    cacheValue = {};
    cache.set(target, cacheValue);
  }
  if (!cacheValue[key]) {
    cacheValue[key] = {};
  }
  cacheValue[key][group] = value;
};
