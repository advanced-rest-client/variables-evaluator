declare interface Variable {
  value: string;
  variable: string;
  enabled: boolean;
}

/**
 * Overrides variables with passed values.
 * @param variables Variables to
 * @param override Values to override the varoables with
 * @return A copy the `variables` object
 */
export declare function overrideContext(variables: Variable[], override: object): Object;

/**
 * Overrides context values post evaluation.
 * @param context Current context
 * @param override Values to override the context with
 * @returns A copy the `context`
 */
export declare function overrideContextPost(context?: object, override?: object): Object;
/**
 * Upgrades old syntax of magic variables to new one.
 * It replaces `${now}` and `${random}` to function calls: `now()` and
 * `random()`. It also keeps grouping.
 *
 * @param value Currently evaluated value
 * @returns Parsed value without old syntax.
 */
export declare function updgradeLegacy(value: string): string;

/**
 * Replaces strings with quoted string and variables notation into
 * variables that Jexl understands.
 *
 * @param value Value to evaluate
 * @returns Proper syntax for Jexl
 */
export declare function prepareValue(value: string): string;

/**
 * Prepars variables to be evaluated where a valuye is a multiline value.
 * @param lines Lines in the exporession
 * @return Processed lines
 */
export declare function prepareMultilineValue(lines: string[]): string[];
export declare function applyArgumentsContext(arg?: string, context?: object): string;

/**
 * A behavior to be implemented to elements that needs to prepare a list of
 * currently loaded variables.
 *
 * It works with `variables-manager` that must be inserted into the DOM
 * to query for list of current variables for current environment.
 */
declare function VariablesMixin<T extends new (...args: any[]) => {}>(base: T): T & VariablesMixinConstructor;
interface VariablesMixinConstructor {
  new(...args: any[]): VariablesMixin;
}

interface VariablesMixin {
  functionRegex: RegExp;

  /**
   * Cached context for current operation.
   */
  context: Object;

  /**
   * A reference name to the Jexl object.
   * Use dot notation to access it from the `window` object.
   * To set class pointer use `jexl` property.
   */
  jexlPath: String;

  /**
   * A Jexl class reference.
   * If this value is set it must be a pointer to the Jexl class and
   * `jexlPath` is ignored.
   * This property is set automatically when `jexlPath` is processed.
   */
  jexl: Object;

  /**
   * A reference to Jexl.
   */
  readonly _jexl: Object|null;

  /**
   * Finds Jexl object for `jexlPath` path.
   * @returns A reference to Jexl.
   */
  _setupJexl(): Object|null;

  /**
   * Resets `cache` and `context` for clean run.
   */
  reset(): void;

  /**
   * Clears cached groups.
   */
  clearCache(): void;

  /**
   * Requests for a variables list from the variables manager
   * and creates a context for Jexl.
   *
   * If the `variables-manager` is not present it returns empty object.
   *
   * @param override Map of key - value pars to override variables
   * or to add temporary variables to the context. Values for keys that
   * exists in variables array (the `variable` property) will update value of
   * the variable. Rest is added to the list.
   * @returns Promise resolved to a context to be passed to Jexl.
   */
  buildContext(override?: Object): Promise<Object>;

  /**
   * Processes variables in the context recuresively.
   *
   * @param result A result to where put the values.
   * @param variables A list of current variables
   * @param requireEvaluation A list of variables that require evaluation
   * @param runCount Current run count in the recursive function. It stops execuring after second run.
   * @returns Evaluated `result` value.
   */
  _processContextVariables(result: object, variables: Array<Object>, requireEvaluation?: Array<Object>, runCount?: number): Promise<Object>;
  _processContextVariablesPost(variables: object): Promise<Object>;

  /**
   * Evaluates a value against a variables.
   *
   * @param value A value to evaluate
   * @param context Optional. Context for Jexl. If not set it will
   * get a context from variables manager.
   * @param override A list of variables to override in created context.
   * @returns Promise that resolves to evaluated value.
   */
  evaluateVariable(value: string, context?: object, override?: string): Promise<string>;
  /**
   * Evaluates a value with context passed to Jexl.
   * @param context Jexl's context
   * @param value Value to evaluate
   */
  evaluateWithContext(context: Object, value: string): Promise<string>;

  /**
   * Recursively evaluate variables on an object.
   *
   * @param obj The map containg variables
   * @param props Optional, list of properties to evaluate.
   * If not set then it scans for all keys in the object.
   * @returns Promise resolved to evalusated object.
   */
   evaluateVariables(obj: Object, props?: Array<string>): Promise<string>;

   /**
    * Evaluates functions.
    *
    * @param value A value to evaluate
    * @returns Evaluated value with removed functions.
    * @throws Error if a function is not supported.
    */
   _evalFunctions(value: string): string;

   /**
    * Calls one of the predefined functions and returns its value.
    *
    * @param fnName A function name to call.
    * @param args Arguments find in the expression.
    * @returns Result of calling a function. Always a string.
    */
   _callFn(fnName: string, args?: string[]): string|number;

   /**
    * Calls JavaScript native function.
    * Currently only `Math`, 'JSON', and `String` namespaces are supported.
    *
    * @param namespace The namespace of the function to call
    * @param fn Name of the function to call
    * @param args A list of arguments to call
    * @returns Processed value.
    */
   _callNamespaceFunction(namespace: string, fn: string, args?: string[]): string|number;

   /**
    * Calls the `now()` function. Returns current timestamp.
    * If argument is passed is will try to retreive existing cached value
    * or create new one.
    *
    * @param args Arguments passed to the function
    * @returns Current timestamp
    */
   __evalFnNow(args: string[]): number;
   /**
    * Generates random integer value. If a group is passed in the `args` then
    * it looks for the value in the cache and prefers it if available.
    *
    * @param args Arguments passed to the function
    * @returns Current timestamp
    */
   __evalFnRandom(args: string[]): number;

   /**
    * Returns a random `int` between 0 (inclusive) and
    * `Number.MAX_SAFE_INTEGER` (exclusive) with roughly equal probability of
    * returning any particular `int` in this range.
    */
   __randomInt(): number;
}
export {VariablesMixinConstructor};
export {VariablesMixin};
