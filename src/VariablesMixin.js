import { dedupeMixin } from '@open-wc/dedupe-mixin';
import { VariablesTokenizer } from './VariablesTokenizer.js';
import { EvalFunctions } from './EvalFunctions.js';
import { clear, find, store } from './Cache.js'; // these methods need to be there.

/**
 * @typedef {Object} Variable
 * @property {String} value
 * @property {String} variable
 */

/**
@license
Copyright 2018 The Advanced REST client authors <arc@mulesoft.com>
Licensed under the Apache License, Version 2.0 (the "License"); you may not
use this file except in compliance with the License. You may obtain a copy of
the License at
http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
License for the specific language governing permissions and limitations under
the License.
*/

/* eslint-disable no-await-in-loop */
/* eslint-disable class-methods-use-this */ /* eslint-disable no-bitwise */

/**
 * Overrides variables with passed values.
 * @param {Array<Variable>} variables Variables to
 * @param {Object} override Values to override the varoables with
 * @return {Object} A copy the `variables` object
 */
export const overrideContext = (variables, override) => {
  const copy = { ...override };
  const result = variables.map(item => {
    if (item.variable in copy) {
      /* eslint-disable no-param-reassign */
      item.value = copy[item.variable];
      delete copy[item.variable];
    }
    return { ...item };
  });
  Object.keys(copy).forEach(key => {
    result.push({
      variable: key,
      value: copy[key],
    });
  });
  return result;
};

/**
 * Overrides context values post evaluation.
 * @param {Object} context Current context
 * @param {Object} override Values to override the context with
 * @return {Object} A copy the `context`
 */
export const overrideContextPost = (context, override) => {
  if (!context || !override) {
    return context;
  }
  const result = { ...context };
  Object.entries(override).forEach(([key, value]) => {
    result[key] = value;
  });
  return result;
};

/**
 * Upgrades old syntax of magic variables to new one.
 * It replaces `${now}` and `${random}` to function calls: `now()` and
 * `random()`. It also keeps grouping.
 *
 * @param {string} value Currently evaluated value
 * @return {String} Parsed value without old syntax.
 */
export const updgradeLegacy = value => {
  const reg = /\${(random|now):?([0-9]+)?}/gm;
  const test = reg.test(value);
  if (!test) {
    return value;
  }
  reg.lastIndex = 0;
  const loopTest = true;
  while (loopTest) {
    const matches = reg.exec(value);
    if (!matches) {
      break;
    }
    const variable = matches[0];
    const word = matches[1];
    const group = matches[2];
    let replacement = `\${${word}(`;
    if (group) {
      replacement += group;
    }
    replacement += ')}';
    value = value.replace(variable, replacement);
    reg.lastIndex -= 2; // replacement word is shorter by 2 characters
  }
  return value;
};

/**
 * Replaces strings with quoted string and variables notation into
 * variables that Jexl understands.
 *
 * @param {String} value Value to evaluate
 * @return {String} Proper syntax for Jexl
 */
export const prepareValue = value => {
  if (!value || String(value).indexOf('${') === -1) {
    return value;
  }
  value = value.replace(/'/g, "\\'");
  const tokenizer = new VariablesTokenizer(value);
  let parsed = '';
  const loopTest = true;
  while (loopTest) {
    const _startIndex = tokenizer.index;
    const left = tokenizer.nextUntil('$');
    if (left === null) {
      // no more variables
      if (!parsed) {
        return value;
      }
      tokenizer.index = _startIndex;
      parsed += `'${tokenizer.eof()}'`;
      return parsed;
    }
    let variable = tokenizer.nextUntil('}');
    if (!variable) {
      throw new Error('Syntax error. Unclosed curly bracket.');
    }
    variable = variable.substr(1);
    const replacement = ` + ${variable} + `;
    let newValue = '';
    newValue += `'${left}'`;
    newValue += replacement;
    parsed += newValue;
  }
  return value;
};

/**
 * Prepars variables to be evaluated where a valuye is a multiline value.
 * @param {string[]} lines Lines in the exporession
 * @return {string[]} Processed lines
 */
export const prepareMultilineValue = lines => {
  return lines.map(line => {
    let _res = prepareValue(line);
    if (_res === line) {
      _res = _res.replace(/'/g, "\\'");
      _res = _res.replace(/\\\\/, '\\\\\\');
      _res = `'${_res}'`;
    }
    return _res;
  });
};

export const applyArgumentsContext = (arg, context) => {
  if (String(arg).indexOf('${') === 0) {
    arg = arg.substr(2, arg.length - 3);
    if (context[arg]) {
      return context[arg];
    }
  }
  return arg;
};

/**
 * @param {typeof HTMLElement} base
 */
const mxFunction = base => {
  class VariablesMixinImpl extends base {
    static get properties() {
      return {
        functionRegex: { type: Object },
        /**
         * Cached context for current operation.
         */
        context: { type: Object },
        /**
         * A reference name to the Jexl object.
         * Use dot notation to access it from the `window` object.
         * To set class pointer use `jexl` property.
         */
        jexlPath: { type: String },
        /**
         * A Jexl class reference.
         * If this value is set it must be a pointer to the Jexl class and
         * `jexlPath` is ignored.
         * This property is set automatically when `jexlPath` is processed.
         */
        jexl: { type: Object },
      };
    }

    constructor() {
      super();
      /**
       * @type {RegExp}
       */
      this.functionRegex = /(?:\${)?([.a-zA-Z0-9_-]+)\(([^)]*)?\)(?:})?/gm;
      /**
       * @type {string}
       */
      this.jexlPath = null;
    }

    /**
     * @return {Object|null} A reference to Jexl.
     */
    get _jexl() {
      if (!this.jexl) {
        this.jexl = this._setupJexl();
      }
      return this.jexl;
    }

    /**
     * Finds Jexl object for `jexlPath` path.
     * @return {Object|null} A reference to Jexl.
     */
    _setupJexl() {
      const ref = this.jexlPath;
      if (!ref || typeof ref !== 'string') {
        return null;
      }
      const parts = ref.split('.');
      const len = parts.length;
      if (len === 1) {
        return window[parts[0]];
      }
      let current = window;
      /* eslint-disable no-plusplus */
      for (let i = 0; i < len; i++) {
        current = current[parts[i]];
        if (!current) {
          return null;
        }
      }
      return current;
    }

    /**
     * Resets `cache` and `context` for clean run.
     */
    reset() {
      this.context = undefined;
      this.clearCache();
    }

    /**
     * Clears cached groups.
     */
    clearCache() {
      clear(this);
    }

    /**
     * Requests for a variables list from the variables manager
     * and creates a context for Jexl.
     *
     * If the `variables-manager` is not present it returns empty object.
     *
     * @param {Object=} override Map of key - value pars to override variables
     * or to add temporary variables to the context. Values for keys that
     * exists in variables array (the `variable` property) will update value of
     * the variable. Rest is added to the list.
     * @return {Promise} Promise resolved to a context to be passed to Jexl.
     */
    async buildContext(override = {}) {
      const copy = { ...override };
      const e = new CustomEvent('environment-current', {
        cancelable: true,
        composed: true,
        bubbles: true,
        detail: {
          variables: undefined,
        },
      });
      this.dispatchEvent(e);
      const result = {};
      if (!e.defaultPrevented) {
        return result;
      }
      let { variables } = e.detail;
      if (!variables || !variables.length) {
        return result;
      }
      // Filter out disabled items
      variables = variables.filter(item => item.enabled);
      variables = overrideContext(variables, copy);
      return this._processContextVariables(result, variables);
    }

    /**
     * Processes variables in the context recuresively.
     *
     * @param {Object} result A result to where put the values.
     * @param {Array<Variable>} variables A list of current variables
     * @param {Array<Variable>=} requireEvaluation A list of variables that require evaluation
     * @param {Number=} runCount Current run count in the recursive function. It stops execuring
     * after second run.
     * @return {Promise<Object>} Evaluated `result` value.
     */
    async _processContextVariables(
      result,
      variables,
      requireEvaluation,
      runCount
    ) {
      if (!requireEvaluation) {
        requireEvaluation = variables.filter(
          item => String(item.value).indexOf('${') !== -1
        );
      }
      variables.forEach(item => {
        result[item.variable] = item.value;
      });
      if (requireEvaluation.length === 0) {
        return result;
      }
      // this array should be sorted so items that should be evaluated first
      // because are a dependencies of other expressions.
      for (let i = 0, len = requireEvaluation.length; i < len; i++) {
        const item = requireEvaluation[i];
        const value = await this.evaluateVariable(item.value, result);
        result[item.variable] = value;
        item.value = value;
      }

      requireEvaluation = requireEvaluation.filter(
        item => String(item.value).indexOf('${') !== -1
      );
      runCount = runCount || 1;
      if (requireEvaluation.length === 0 || runCount >= 2) {
        this.context = result;
        return result;
      }
      runCount++;
      return this._processContextVariables(
        result,
        variables,
        requireEvaluation,
        runCount
      );
    }

    async _processContextVariablesPost(variables) {
      const tmp = [];
      Object.entries(variables).forEach(([key, value]) => {
        tmp[tmp.length] = {
          variable: key,
          value,
        };
      });
      return this._processContextVariables({}, tmp);
    }

    /**
     * Evaluates a value against a variables.
     *
     * @param {String} value A value to evaluate
     * @param {Object=} context Optional. Context for Jexl. If not set it will
     * get a context from variables manager.
     * @param {Object=} override A list of variables to override in created context.
     * @return {Promise} Promise that resolves to evaluated value.
     */
    async evaluateVariable(value, context, override) {
      const typeOf = typeof value;
      // Non primitives + null
      if (typeOf === 'object') {
        return value;
      }
      if (typeOf !== 'string') {
        value = String(value);
      }
      let promise;
      context = context || this.context;
      if (context) {
        if (override) {
          context = overrideContextPost(context, override);
          promise = this._processContextVariablesPost(context);
        } else {
          promise = context;
        }
      } else {
        promise = this.buildContext(override);
      }
      const result = await promise;
      return this.evaluateWithContext(result, value);
    }

    /**
     * Evaluates a value with context passed to Jexl.
     * @param {Object} context Jexl's context
     * @param {string} value Value to evaluate
     * @return {Promise} [description]
     */
    async evaluateWithContext(context, value) {
      value = updgradeLegacy(value);
      value = this._evalFunctions(value);
      if (!value || String(value).indexOf('${') === -1) {
        return value;
      }
      let result;
      const parts = value.split('\n');
      if (parts.length > 1) {
        result = prepareMultilineValue(parts);
      } else {
        result = prepareValue(value);
      }

      const JxRef = this._jexl;
      if (!JxRef) {
        return result;
      }
      let jexl;
      if (!JxRef.eval && JxRef.constructor) {
        jexl = new JxRef();
      } else {
        jexl = JxRef;
      }

      if (result instanceof Array) {
        const items = [];
        for (let i = 0, len = result.length; i < len; i++) {
          const item = result[i];
          items[items.length] = await jexl.eval(item, context);
        }
        return items.join('\n');
      }
      return jexl.eval(result, context);
    }

    /**
     * Recursively evaluate variables on an object.
     *
     * @param {Object} obj The map containg variables
     * @param {Array<String>=} props Optional, list of properties to evaluate.
     * If not set then it scans for all keys in the object.
     * @return {Promise} Promise resolved to evalusated object.
     */
    async evaluateVariables(obj, props) {
      props = props || Object.keys(obj);
      const prop = props.shift();
      if (!prop) {
        return obj;
      }
      if (!obj[prop]) {
        return this.evaluateVariables(obj, props);
      }
      obj[prop] = await this.evaluateVariable(obj[prop]);
      return this.evaluateVariables(obj, props);
    }

    /**
     * Evaluates functions.
     *
     * @param {String} value A value to evaluate
     * @returns {String} Evaluated value with removed functions.
     * @throws Error if a function is not supported.
     */
    _evalFunctions(value) {
      if (!value) {
        return '';
      }
      const re = this.functionRegex;
      re.lastIndex = 0;
      const cnd = true;
      while (cnd) {
        const matches = re.exec(value);
        if (!matches) {
          break;
        }
        const fnName = matches[1];
        const argsStr = matches[2];
        let args;
        if (argsStr) {
          args = argsStr.split(',').map(item => item.trim());
        }
        const _value = this._callFn(fnName, args);
        value = value.replace(matches[0], String(_value));
        re.lastIndex -= matches[0].length - String(_value).length;
      }
      return value;
    }

    /**
     * Calls one of the predefined functions and returns its value.
     *
     * @param {String} fnName A function name to call.
     * @param {Array<String>=} args Arguments find in the expression.
     * @return {string|number} Result of calling a function. Always a string.
     */
    _callFn(fnName, args) {
      const dotIndex = fnName.indexOf('.');
      if (dotIndex !== -1) {
        const namespace = fnName.substr(0, dotIndex);
        const name = fnName.substr(dotIndex + 1);
        if (['Math', 'String', 'JSON'].indexOf(namespace) !== -1) {
          try {
            return this._callNamespaceFunction(namespace, name, args);
          } catch (e) {
            throw new Error(`Unsuppored function ${fnName}`);
          }
        }
      } else {
        fnName = fnName[0].toUpperCase() + fnName.substr(1);
        if (fnName in EvalFunctions) {
          return EvalFunctions[fnName](args);
        }
        const localFnName = `__evalFn${fnName}`;
        if (typeof this[localFnName] === 'function') {
          return this[localFnName](args);
        }
      }
      throw new Error(`Unsuppored function ${fnName}`);
    }

    /**
     * Calls JavaScript native function.
     * Currently only `Math`, 'JSON', and `String` namespaces are supported.
     *
     * @param {String} namespace The namespace of the function to call
     * @param {String} fn Name of the function to call
     * @param {String[]=} args A list of arguments to call
     * @return {string|number} Processed value.
     */
    _callNamespaceFunction(namespace, fn, args) {
      const { context } = this;
      if (context) {
        args = args.map(arg => applyArgumentsContext(arg, context));
      }
      if (namespace === 'Math' || namespace === 'JSON') {
        return window[namespace][fn].apply(window, args);
      }
      if (namespace === 'String') {
        if (!args || !args.length) {
          throw new Error('String functions need an argument');
        }
        const str = args.shift();
        return String.prototype[fn].apply(str, args);
      }
      return '';
    }

    /**
     * Calls the `now()` function. Returns current timestamp.
     * If argument is passed is will try to retreive existing cached value
     * or create new one.
     *
     * @param {Array<string>} args Arguments passed to the function
     * @return {Number} Current timestamp
     */
    __evalFnNow(args) {
      const key = '__evalFnNow';
      const hasGroup = !!(args && args[0]);
      let value;
      if (hasGroup) {
        value = find(this, key, args[0]);
      }
      if (!value) {
        value = Date.now();
      }
      if (hasGroup) {
        store(this, key, args[0], value);
      }
      return /** @type Number */ (value);
    }

    /**
     * Generates random integer value. If a group is passed in the `args` then
     * it looks for the value in the cache and prefers it if available.
     *
     * @param {Array<string>} args Arguments passed to the function
     * @return {number} Current timestamp
     */
    __evalFnRandom(args) {
      const key = '__evalFnRandom';
      const hasGroup = !!(args && args[0]);
      let value;
      if (hasGroup) {
        value = find(this, key, args[0]);
      }
      if (!value) {
        value = this.__randomInt();
      }
      if (hasGroup) {
        store(this, key, args[0], value);
      }
      return /** @type Number */ (value);
    }

    /**
     * Returns a random `int` between 0 (inclusive) and
     * `Number.MAX_SAFE_INTEGER` (exclusive) with roughly equal probability of
     * returning any particular `int` in this range.
     *
     * @return {Number}
     */
    __randomInt() {
      // "|0" forces the value to a 32 bit integer.
      // Number.MAX_SAFE_INTEGER
      return Math.abs(Math.floor(Math.random() * 9007199254740991) | 0);
    }
  }
  return VariablesMixinImpl;
};
/**
 * A behavior to be implemented to elements that needs to prepare a list of
 * currently loaded variables.
 *
 * It works with `variables-manager` that must be inserted into the DOM
 * to query for list of current variables for current environment.
 *
 * @mixin
 */
export const VariablesMixin = dedupeMixin(mxFunction);
