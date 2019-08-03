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
import { LitElement } from 'lit-element';
import { EventsTargetMixin } from '@advanced-rest-client/events-target-mixin/events-target-mixin.js';
import { VariablesContextBuilderMixin } from './variables-context-builder-mixin.js';
/**
 * `<variables-evaluator>` Variables evaluator for the Advanced REST Client
 *
 * The element listens for `before-request` custom event and evaluates its
 * properties. This element is responsible for applying variables to the request.
 *
 * This elements works with `variables-manager`. When evaluation has been requested
 * it asks the manager for list of current variables. After the list is evaluated
 * then the requested value is evaluated for the variables.
 *
 * ### Example
 *
 * ```html
 * <variables-evaluator></variables-evaluator>
 * ```
 *
 * A value can be evaluated on demand by dispatching `evaluate-variable` custom
 * event. It will perform evaluation on the `value` property of the detail object.
 * The element adds a `result` property to the detail object which is a Promise
 * that resolves to a value.
 * The event is cancelled and it's propagation is stopped so other evaluators won't
 * perform the same task again.
 *
 * ### Example
 *
 * ```javascript
 * // requesting to create an environment
 * const e = new CustomEvent('evaluate-variable', {
 *    bubbles: true,
 *    composed: true,
 *    cancelable: true,
 *    detail: {
 *      value: 'The timestamp is now() and generating random() value'
 *    }
 * });
 * document.dispatchEvent(e);
 * console.log(e.defaultPrevented); // true
 * e.detail.result.then(function(value) {
 *    console.log(value);
 * })
 * .catch(function(cause) {
 *    console.log(cause.message);
 * });
 * ```
 *
 * ## Changes in 2.0
 *
 * Jexl is now optional dependency. Install it from other sources and include into
 * the web app. The web component version is offered by `advanced-rest-client/Jexl#^2.0.0`.
 * Node version can be installed from `npm install jexl --save`.
 * This prevents double inclusion in Electron environment.
 *
 * @memberof LogicElements
 * @customElement
 * @demo demo/index.html
 * @appliesMixin VariablesContextBuilderMixin
 * @appliesMixin EventsTargetBehavior
 */
class VariablesEvaluator extends EventsTargetMixin(VariablesContextBuilderMixin(LitElement)) {
  static get properties() {
    return {
      /**
       * If set it will not handle `before-request` event
       */
      noBeforeRequest: { type: Boolean }
    };
  }

  constructor() {
    super();
    this._beforeRequestHandler = this._beforeRequestHandler.bind(this);
    this._evaluateVariableHandler = this._evaluateVariableHandler.bind(this);
  }

  connectedCallback() {
    /* istanbul ignore else */
    if (super.connectedCallback) {
      super.connectedCallback();
    }
    this.setAttribute('aria-hidden', 'true');
  }

  _attachListeners(node) {
    node.addEventListener('before-request', this._beforeRequestHandler);
    node.addEventListener('evaluate-variable', this._evaluateVariableHandler);
  }

  _detachListeners(node) {
    node.removeEventListener('before-request', this._beforeRequestHandler);
    node.removeEventListener('evaluate-variable', this._evaluateVariableHandler);
  }

  _beforeRequestHandler(e) {
    if (this.noBeforeRequest) {
      return;
    }
    const promises = e.detail.promises;
    if (!(promises instanceof Array)) {
      return;
    }
    e.detail.promises.push(this.processBeforeRequest(e.detail));
  }
  /**
   * A function to call directly on the element to process request object on
   * before request event.
   *
   * @param {Object} request ARC request object to process.
   * @param {Object} override Optional. If not set then it clears the context
   * and builds new one. Map of key-value pars to override variables
   * or to add temporary variables to the context. Values for keys that
   * exists in variables array (the `variable` property) will update value of
   * the variable. Rest is added to the list.
   * @return {Promise} Promise resolved to a request object.
   */
  async processBeforeRequest(request, override) {
    if (!override) {
      if (request.config && request.config.variables) {
        override = request.config.variables;
      }
    }
    this.reset();
    return await this._processBeforeRequest(request, override);
  }

  async _processBeforeRequest(request, override) {
    let promise;
    if (this.context) {
      promise = this.context;
    } else {
      promise = this.buildContext(override);
    }

    const context = await promise;
    const props = ['url', 'method', 'headers', 'payload'];
    for (let i = 0, len = props.length; i < len; i++) {
      const property = props[i];
      if (!request[property]) {
        continue;
      }
      const value = await this.evaluateVariable(request[property], context);
      request[property] = value;
    }
    return request;
  }

  _evaluateVariableHandler(e) {
    if (e.defaultPrevented) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const { value, override, context } = e.detail;

    this.cache = undefined;
    this.context = undefined;
    e.detail.result = this.evaluateVariable(value, context, override);
  }
}
window.customElements.define('variables-evaluator', VariablesEvaluator);
