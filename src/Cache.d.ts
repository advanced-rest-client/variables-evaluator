/**
 * Removes cached values from the store.
 * @param target The cache target, element or object extending the mixin
 */
export declare function clear(target: object): void;

/**
 * Finds cached group.
 *
 * @param {Object} target The cache target, element or object extending the mixin
 * @param {String} key A key where a function keeps cached objects
 * @param {String} group Group name. Defined by user as an argument.
 * @return {string|number|null} Cached value.
 */
export declare function find(target: object, key: string, group: string): string|number|null;

/**
 * Stores value in cache.
 *
 * @param {Object} target The cache target, element or object extending the mixin
 * @param {String} key A key where a function keeps cached objects
 * @param {String} group Group name. Defined by user as an argument.
 * @param {string|number} value Cached value.
 */
export declare function store(target: object, key: string, group: string, value: string|number): void;
