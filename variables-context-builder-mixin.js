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
class VariablesTokenizer {
  constructor(value) {
    this.value = value;
    this.index = 0;
  }

  next() {
    const char = this.value[this.index];
    this.index++;
    return char;
  }

  nextUntil(char) {
    let result = '';
    const test = true;
    while (test) {
      const ch = this.next();
      if (ch === undefined) {
        return null;
      }
      if (ch === char) {
        return result;
      }
      result += ch;
    }
  }

  eof() {
    const result = this.value.substr(this.index);
    this.index = this.value.length;
    return result;
  }
}
/**
 * A behavior to be implemented to elements that needs to prepare a list of
 * currently loaded variables.
 *
 * It works with `variables-manager` that must be inserted into the DOM
 * to query for list of current variables for current environment.
 *
 * @mixinFunction
 * @memberof ArcMixins
 * @param {Function} base
 * @return {Function}
 */
export const VariablesContextBuilderMixin = (base) => class extends base {
  static get properties() {
    return {
      functionRegex: {
        type: RegExp
      },
      // Cached context for current operation.
      context: { type: Object },
      // A cache object for groupping
      cache: { type: Object },
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
      jexl: { type: Object }
    };
  }

  constructor() {
    super();
    this.functionRegex = /(?:\${)?([.a-zA-Z0-9_-]+)\(([^)]*)?\)(?:})?/gm;
  }

  get _jexl() {
    if (!this.jexl) {
      this.jexl = this._setupJexl();
    }
    return this.jexl;
  }

  _setupJexl() {
    const ref = this.jexlPath;
    if (!ref || typeof ref !== 'string') {
      return;
    }
    const parts = ref.split('.');
    const len = parts.length;
    if (len === 1) {
      return window[parts[0]];
    }
    let current = window;
    for (let i = 0; i < len; i++) {
      current = current[parts[i]];
      if (!current) {
        return;
      }
    }
    return current;
  }
  /**
   * Resets `cache` and `context` for clean run.
   */
  reset() {
    this.context = undefined;
    this.cache = undefined;
  }
  /**
   * Requests for a variables list from the variables manager
   * and creates a context for Jexl.
   *
   * If the `variables-manager` is not present it returns empty object.
   *
   * @param {Object} override Map of key - value pars to override variables
   * or to add temporary variables to the context. Values for keys that
   * exists in variables array (the `variable` property) will update value of
   * the variable. Rest is added to the list.
   * @return {Promise} Promise resolved to a context to be passed to Jexl.
   */
  async buildContext(override) {
    if (!override) {
      override = {};
    }
    override = Object.assign({}, override);
    const e = new CustomEvent('environment-current', {
      cancelable: true,
      composed: true,
      bubbles: true,
      detail: {}
    });
    this.dispatchEvent(e);
    const result = {};
    if (!e.defaultPrevented) {
      return result;
    }
    let variables = e.detail.variables;
    if (!variables || !variables.length) {
      return result;
    }
    // Filter out disabled items
    variables = variables.filter((item) => item.enabled);
    variables = this._overrideContext(variables, override);
    return await this._processContextVariables(result, variables);
  }

  _overrideContext(variables, override) {
    override = Object.assign({}, override);
    variables = variables.map((item) => {
      if (item.variable in override) {
        item.value = override[item.variable];
        delete override[item.variable];
      }
      return Object.assign({}, item);
    });
    Object.keys(override).forEach((key) => {
      variables.push({
        variable: key,
        value: override[key]
      });
    });
    return variables;
  }

  _overrideContextPost(context, override) {
    if (!context || !override) {
      return context;
    }
    override = Object.assign({}, override);
    context = Object.assign({}, context);
    Object.entries(override).forEach(([key, value]) => {
      context[key] = value;
    });
    return context;
  }

  async _processContextVariables(result, variables, requireEvaluation, runCount) {
    if (!requireEvaluation) {
      requireEvaluation = variables.filter((item) => !!~String(item.value).indexOf('${'));
    }
    variables.forEach((item) => result[item.variable] = item.value);
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

    requireEvaluation = requireEvaluation.filter((item) => !!~String(item.value).indexOf('${'));
    runCount = runCount || 1;
    if (requireEvaluation.length === 0 || runCount >= 2) {
      this.context = result;
      return result;
    }
    runCount++;
    return this._processContextVariables(result, variables, requireEvaluation, runCount);
  }

  async _processContextVariablesPost(variables) {
    const tmp = [];
    Object.entries(variables).forEach(([key, value]) => {
      tmp[tmp.length] = {
        variable: key,
        value
      };
    });
    return await this._processContextVariables({}, tmp);
  }

  /**
   * Evaluates a value against a variables.
   *
   * @param {String} value A value to evaluate
   * @param {?Object} context Optional. Context for Jexl. If not set it will
   * get a context from variables manager.
   * @param {?Object} override A list of variables to override in created context.
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
        context = this._overrideContextPost(context, override);
        promise = this._processContextVariablesPost(context);
      } else {
        promise = context;
      }
    } else {
      promise = this.buildContext(override);
    }
    const result = await promise;
    return await this._evaluateWithContext(result, value);
  }

  async _evaluateWithContext(context, value) {
    try {
      value = this._updgradeLegacy(value);
      value = this._evalFunctions(value);
      if (!value || !~String(value).indexOf('${')) {
        return value;
      }
      const parts = value.split('\n');
      if (parts.length > 1) {
        value = this._prepareMultilineValue(parts);
      } else {
        value = this._prepareValue(value);
      }
    } catch (e) {
      throw e;
    }
    const JxRef = this._jexl;
    if (!JxRef) {
      return value;
    }
    let jexl;
    if (!JxRef.eval && JxRef.constructor) {
      jexl = new JxRef();
    } else {
      jexl = JxRef;
    }

    if (value instanceof Array) {
      const parts = [];
      for (let i = 0, len = value.length; i < len; i++) {
        const item = value[i];
        parts[parts.length] = await jexl.eval(item, context);
      }
      return parts.join('\n');
    }
    return await jexl.eval(value, context);
  }
  /**
   * Recursively evaluate variables on an object.
   *
   * @param {Object} obj The map containg variables
   * @param {?Array<String>} props Optional, list of properties to evaluate.
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
      return await this.evaluateVariables(obj, props);
    }
    obj[prop] = await this.evaluateVariable(obj[prop]);
    return await this.evaluateVariables(obj, props);
  }
  /**
   * Upgrades old syntax of magic variables to new one.
   * It replaces `${now}` and `${random}` to function calls: `now()` and
   * `random()`. It also keeps grouping.
   *
   * @param {String} value Currently evaluated value
   * @return {String} Parsed value without old syntax.
   */
  _updgradeLegacy(value) {
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
      let replacement = '${' + word + '(';
      if (group) {
        replacement += group;
      }
      replacement += ')' + '}';
      value = value.replace(variable, replacement);
      reg.lastIndex -= 2; // replacement word is shorter by 2 characters
    }
    return value;
  }
  /**
   * Evaluates functions.
   *
   * @param {String} value A value to evaluate
   * @return {String} Evaluated value with removed functions.
   * @throws Error if a function is not supported.
   */
  _evalFunctions(value) {
    if (!value) {
      return;
    }
    const re = this.functionRegex;
    re.lastIndex = 0;
    let matches;
    while ((matches = re.exec(value))) {
      const fnName = matches[1];
      let args = matches[2];
      if (args) {
        args = args.split(',').map((item) => item.trim());
      }
      const _value = this._callFn(fnName, args);
      value = value.replace(matches[0], _value);
      re.lastIndex -= (matches[0].length - String(_value).length);
    }
    return value;
  }
  /**
   * Calls one of the predefined functions and returns its value.
   *
   * @param {String} fnName A function name to call.
   * @param {?Array} args Arguments find in the expression.
   * @return {String} Result of calling a function. Always a string.
   */
  _callFn(fnName, args) {
    const dotIndex = fnName.indexOf('.');
    if (~dotIndex) {
      const namespace = fnName.substr(0, dotIndex);
      const name = fnName.substr(dotIndex + 1);
      if (~['Math', 'String', 'JSON'].indexOf(namespace)) {
        try {
          return this._callNamespaceFunction(namespace, name, args);
        } catch (e) {
          throw new Error('Unsuppored function ' + fnName);
        }
      }
    } else {
      fnName = fnName[0].toUpperCase() + fnName.substr(1);
      const localFnName = '__evalFn' + fnName;
      if (typeof this[localFnName] === 'function') {
        return this[localFnName](args);
      }
    }
    throw new Error('Unsuppored function ' + fnName);
  }

  _prepareMultilineValue(lines) {
    return lines.map((line) => {
      let _res = this._prepareValue(line);
      if (_res === line) {
        _res = _res.replace(/'/g, '\\\'');
        _res = _res.replace(/\\\\/, '\\\\\\');
        _res = '\'' + _res + '\'';
      }
      return _res;
    });
  }

  /**
   * Replaces strings witht quoted string and variables notation into
   * variables that Jexl will understand.
   *
   * @param {String} value Value to evaluate
   * @return {String} Proper syntax for Jexl
   */
  _prepareValue(value) {
    if (!value || !~String(value).indexOf('${')) {
      return value;
    }
    value = value.replace(/'/g, '\\\'');
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
        parsed += '\'' + tokenizer.eof() + '\'';
        return parsed;
      }
      let variable = tokenizer.nextUntil('}');
      if (!variable) {
        throw new Error('Syntax error. Unclosed curly bracket.');
      }
      variable = variable.substr(1);
      const replacement = ' + ' + variable + ' + ';
      let newValue = '';
      newValue += '\'' + left + '\'';
      newValue += replacement;
      parsed += newValue;
    }
    return value;
  }
  /**
   * Calls JavaScript native function.
   *
   * @param {[type]} namespace [description]
   * @param {Function} fn [description]
   * @param {[type]} args [description]
   * @return {[type]} [description]
   */
  _callNamespaceFunction(namespace, fn, args) {
    const context = this.context;
    if (context) {
      args = args.map((arg) => this._applyArgumentsContext(arg, context));
    }
    if (namespace === 'Math' || namespace === 'JSON') {
      return window[namespace][fn].apply(window, args);
    } else if (namespace === 'String') {
      if (!args || !args.length) {
        throw new Error('String functions need an argument');
      }
      const str = args.shift();
      return String.prototype[fn].apply(str, args);
    }
  }

  _applyArgumentsContext(arg, context) {
    if (String(arg).indexOf('${') === 0) {
      arg = arg.substr(2, arg.length - 3);
      if (context[arg]) {
        return context[arg];
      }
    }
    return arg;
  }
  /**
   * Calls the `now()` function. Returns current timestamp.
   * If argument is passed is will try to retreive existing cached value
   * or create new one.
   *
   * @param {Array} args Arguments passed to the function
   * @return {Number} Current timestamp
   */
  __evalFnNow(args) {
    const key = '__evalFnNow';
    const hasGroup = !!(args && args[0]);
    let value;
    if (hasGroup) {
      value = this._findInCache(key, args[0]);
    }
    if (!value) {
      value = Date.now();
    }
    if (hasGroup) {
      this._storeCache(key, args[0], value);
    }
    return value;
  }

  __evalFnRandom(args) {
    const key = '__evalFnRandom';
    const hasGroup = !!(args && args[0]);
    let value;
    if (hasGroup) {
      value = this._findInCache(key, args[0]);
    }
    if (!value) {
      value = this.__randomInt();
    }
    if (hasGroup) {
      this._storeCache(key, args[0], value);
    }
    return value;
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
    return Math.abs((Math.floor(Math.random() * 9007199254740991)) | 0);
  }
  /**
   * Calls `encodeURIComponent()` function on the first item of arguments array
   * @param {Array<String>} args List of expression arguments
   * @return {String} Encoded value
   * @throws {Error} When input has no value.
   */
  __evalFnEncodeURIComponent(args) {
    const value = args && args[0];
    if (!value) {
      throw new Error('encodeURIComponent() requires a value');
    }
    return encodeURIComponent(value);
  }
  /**
   * Calls `decodeURIComponent()` function on the first item of arguments array
   * @param {Array<String>} args List of expression arguments
   * @return {String} Decoded value
   * @throws {Error} When input has no value.
   */
  __evalFnDecodeURIComponent(args) {
    const value = args && args[0];
    if (!value) {
      throw new Error('decodeURIComponent() requires a value');
    }
    return decodeURIComponent(value);
  }

  /**
   * Finds cached group.
   *
   * @param {String} key A key where a function keeps cached objects
   * @param {String} group Group name. Defined by user as an argument.
   * @return {String} Cached value.
   */
  _findInCache(key, group) {
    if (!this.cache) {
      return;
    }
    if (!this.cache[key]) {
      return;
    }
    return this.cache[key][group];
  }
  /**
   * Stores value in cache.
   *
   * @param {String} key A key where a function keeps cached objects
   * @param {String} group Group name. Defined by user as an argument.
   * @param {String} value Cached value.
   */
  _storeCache(key, group, value) {
    if (!this.cache) {
      this.cache = {};
    }
    if (!this.cache[key]) {
      this.cache[key] = {};
    }
    this.cache[key][group] = value;
  }
};
