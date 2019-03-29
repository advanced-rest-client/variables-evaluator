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
import {dedupingMixin} from '../../@polymer/polymer/lib/utils/mixin.js';

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
    while (true) {
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
 * @polymer
 * @mixinFunction
 * @memberof ArcMixins
 */
export const VariablesContextBuilderMixin = dedupingMixin((base) => {
  /**
   * @polymer
   * @mixinClass
   */
  class AFmixin extends base {
    static get properties() {
      return {
        functionRegex: {
          type: RegExp,
          value: function() {
            return /(?:\${)?([\.a-zA-Z0-9_-]+)\(([^)]*)?\)(?:})?/gm;
          }
        },
        // Cached context for current operation.
        context: Object,
        // A cache object for groupping
        cache: Object,
        /**
         * A reference name to the Jexl object.
         * Use dot notation to access it from the `window` object.
         * To set class pointer use `jexl` property.
         */
        jexlPath: String,
        /**
         * A Jexl class reference.
         * If this value is set it must be a pointer to the Jexl class and
         * `jexlPath` is ignored.
         * This property is set automatically when `jexlPath` is processed.
         */
        jexl: Object
      };
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
    buildContext(override) {
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
        return Promise.resolve(result);
      }
      let variables = e.detail.variables;
      if (!variables || !variables.length) {
        return Promise.resolve(result);
      }
      // Filter out disabled items
      variables = variables.filter((item) => item.enabled);
      variables = this._overrideContext(variables, override);
      return this._processContextVariables(result, variables);
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

    _processContextVariables(result, variables, requireEvaluation, runCount) {
      if (!requireEvaluation) {
        requireEvaluation = variables.filter((item) => !!~String(item.value).indexOf('${'));
      }
      variables.forEach((item) => result[item.variable] = item.value);
      if (requireEvaluation.length === 0) {
        return Promise.resolve(result);
      }
      // this array should be sorted so items that should be evaluated first
      // because are a dependencies of other expressions.
      const promises = requireEvaluation.map((item) => {
        return this.evaluateVariable(item.value, result)
        .then((value) => {
          item.value = value;
          return item;
        });
      });
      return Promise.all(promises)
      .then((items) => {
        items.forEach((item) => result[item.variable] = item.value);
        requireEvaluation = items.filter((item) => !!~String(item.value).indexOf('${'));
        runCount = runCount || 1;
        if (requireEvaluation.length === 0 || runCount >= 2) {
          this.context = result;
          return result;
        }
        runCount++;
        return this._processContextVariables(result, variables, requireEvaluation, runCount);
      });
    }

    _processContextVariablesPost(variables) {
      const tmp = [];
      Object.entries(variables).forEach(([key, value]) => {
        tmp[tmp.length] = {
          variable: key,
          value
        };
      });
      return this._processContextVariables({}, tmp);
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
    evaluateVariable(value, context, override) {
      const typeOf = typeof value;
      // Non primitives + null
      if (typeOf === 'object') {
        return Promise.resolve(value);
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
          promise = Promise.resolve(context);
        }
      } else {
        promise = this.buildContext(override);
      }
      return promise
      .then((context) => this._evaluateWithContext(context, value));
    }

    _evaluateWithContext(context, value) {
      try {
        value = this._updgradeLegacy(value);
        value = this._evalFunctions(value);
        if (!value || !~String(value).indexOf('${')) {
          return Promise.resolve(value);
        }
        const parts = value.split('\n');
        if (parts.length > 1) {
          value = this._prepareMultilineValue(parts);
        } else {
          value = this._prepareValue(value);
        }
      } catch (e) {
        return Promise.reject(e);
      }
      if (!this._jexl) {
        console.warn('Jexl library has not been initialized.');
        return Promise.resolve(value);
      }
      if (value instanceof Array) {
        const ps = value.map((item) => this._jexl.eval(item, context));
        return Promise.all(ps)
        .then((result) => result.join('\n'));
      } else {
        return this._jexl.eval(value, context);
      }
      return this._jexl.eval(value, context);
    }
    /**
     * Recursively evaluate variables on an object.
     *
     * @param {Object} obj The map containg variables
     * @param {?Array<String>} props Optional, list of properties to evaluate.
     * If not set then it scans for all keys in the object.
     * @return {Promise} Promise resolved to evalusated object.
     */
    evaluateVariables(obj, props) {
      props = props || Object.keys(obj);
      const prop = props.shift();
      if (!prop) {
        return Promise.resolve(obj);
      }
      if (!obj[prop]) {
        return this.evaluateVariables(obj, props);
      }
      return this.evaluateVariable(obj[prop])
      .then((value) => obj[prop] = value)
      .then(() => this.evaluateVariables(obj, props));
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
      while (true) {
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
      while (true) {
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

    __evalFnEncodeURIComponent(args) {
      const value = args && args[0];
      if (!value) {
        throw new Error('encodeURIComponent() requires a value');
      }
      return encodeURIComponent(value);
    }

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
  }
  return AFmixin;
});
