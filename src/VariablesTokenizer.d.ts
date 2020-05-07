/**
 * Processes string value tokens.
 */
declare class VariablesTokenizer {
  /**
   * The value to process
   */
  value: string;
  /**
   * Current token position
   */
  index: number;
  /**
   * @param value The value to process
   */
  constructor(value: string);

  /**
   * @return Next caracter
   */
  next(): string;

  /**
   * Consumes characters until specified caracter is encountered.
   * @param char The search stop caracter
   * @return The remaining value from the string or null.
   */
  nextUntil(char: string): string|null;

  /**
   * Reads the string from current position until the end and sets the index to the end.
   * @return The string from current position until end.
   */
  eof(): string;
}

export { VariablesTokenizer };
