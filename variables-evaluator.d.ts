import {VariablesEvaluator} from './src/VariablesEvaluator.js';

declare global {
  interface HTMLElementTagNameMap {
    "variables-evaluator": VariablesEvaluator;
  }
}
