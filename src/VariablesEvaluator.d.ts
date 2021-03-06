import {LitElement} from 'lit-element';

import {EventsTargetMixin} from '@advanced-rest-client/events-target-mixin/events-target-mixin.js';

import {VariablesMixin} from './VariablesMixin.js';

export {VariablesEvaluator};

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
 */
declare class VariablesEvaluator {

  /**
   * If set it will not handle `before-request` event
   */
  noBeforeRequest: boolean;
  connectedCallback(): void;
  _attachListeners(node: HTMLElement|Window): void;
  _detachListeners(node: HTMLElement|Window): void;

  /**
   * Handler for the `before-request` event. It does nothing when `noBeforeRequest`
   * is set.
   */
  _beforeRequestHandler(e: CustomEvent): void;

  /**
   * A function to call directly on the element to process request object on
   * before request event.
   *
   * @param request ARC request object to process.
   * @param override Optional. If not set then it clears the context
   * and builds new one. Map of key-value pars to override variables
   * or to add temporary variables to the context. Values for keys that
   * exists in variables array (the `variable` property) will update value of
   * the variable. Rest is added to the list.
   * @returns Promise resolved to a request object.
   */
  processBeforeRequest(request: object, override?: object): Promise<Object>;
  _processBeforeRequest(request: object, override?: object): Promise<Object>;
  _evaluateVariableHandler(e: CustomEvent): void;
}

interface VariablesEvaluator extends EventsTargetMixin, VariablesMixin, LitElement {}
