/**
 * A map of functions that evaluates values with native functions.
 */
export class EvalFunctions {
  /**
   * Calls `encodeURIComponent()` function on the first item of arguments array
   * @param {Array<String>} args List of expression arguments
   * @return {String} Encoded value
   * @throws {Error} When input has no value.
   */
  static EncodeURIComponent(args) {
    const value = args && args[0];
    if (!value) {
      throw new Error('encodeURIComponent() requires a value');
    }
    return encodeURIComponent(value);
  }

  /**
   * Calls `decodeURIComponent()` function on the first item of arguments array
   * @param {Array<string>} args List of expression arguments
   * @return {String} Decoded value
   * @throws {Error} When input has no value.
   */
  static DecodeURIComponent(args) {
    const value = args && args[0];
    if (!value) {
      throw new Error('decodeURIComponent() requires a value');
    }
    return decodeURIComponent(value);
  }
}
