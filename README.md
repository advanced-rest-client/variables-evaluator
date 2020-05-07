[![Published on NPM](https://img.shields.io/npm/v/@advanced-rest-client/variables-evaluator.svg)](https://www.npmjs.com/package/@advanced-rest-client/variables-evaluator)

[![Build Status](https://travis-ci.com/advanced-rest-client/variables-evaluator.svg)](https://travis-ci.com/advanced-rest-client/variables-evaluator)

[![Published on webcomponents.org](https://img.shields.io/badge/webcomponents.org-published-blue.svg)](https://www.webcomponents.org/element/advanced-rest-client/variables-evaluator)

## variables-evaluator

Variables evaluator for Advanced REST Client and API components.

The element handles `evaluate-variable` custom event to evaluate a variable against current
environment variables.

The component queries for current environment dispatching `environment-current` custom event.
The event should be handled and values should be set within the same event loop.
The handler must set `variables` property which is an array of variables with the following properties:

```javascript
{
  enabled: true,
  variable: 'variable-name',
  value: 'replacement value'
}
```

The `evaluate-variable` event will have a `result` property set on the `detail` object of the event.
The property has a promise object resolved to evaluated property.

```javascript
const e = new CustomEvent('evaluate-variable', {
  cancelable: true,
  bubbles: true,
  detail: {
    value: 'string with a ${variable}'
  }
});
document.body.dispatchEvent(e);
e.detail.result.then((value) => {
  console.log(value);
});
```

When `context` property on the `detail` object is specified then the component skips querying for `environment-current`
and use this value as the context. It is a map for variables with values.

Additionally the event can carry `override` property on the detail object. When set
the final context values (whether received from `environment-current` event or via `context` property)
are overwritten values in this map.

```javascript
const e = new CustomEvent('evaluate-variable', {
  cancelable: true,
  bubbles: true,
  detail: {
    value: '${a} ${b} ${c}',
    context: {
      a: 'context value a',
      b: 'context value b'
    },
    override: {
      b: 'override value b',
      c: 'override value c'
    }
  }
});
document.body.dispatchEvent(e);
e.detail.result.then((value) => {
  console.log(value);
  // "context value a override value b override value c"
});
```

## Jexl dependency

Previous versions of this component included Jexl library. This version do not have Jexl as a dependency but it is required to run the component.

You must install [Jexl](https://github.com/TomFrost/Jexl) on your project, and build it for browser. See `dev-lib/` folder for an example of such a build.

Finally you have to either pass the pointer to Jexl library to `jexl` property or point to a relative in the `window` object.

Setting Jexl reference:

```javascript
const eval = document.querySelector('variables-evaluator');
eval.jexl = myJexlVariable;
```

Setting path to Jexl:

```html
<variables-evaluator jexlpath="ArcVariables.JexlDev"></variables-evaluator>
```
This expects the Jexl library to be under `window.ArcVariables.JexlDev` variable.

### API components

This components is a part of [API components ecosystem](https://elements.advancedrestclient.com/)

## Usage

### Installation
```
npm install --save @advanced-rest-client/variables-evaluator
```

### In an html file

```html
<html>
  <head>
    <script type="module">
      import '@advanced-rest-client/variables-evaluator/variables-evaluator.js';
    </script>
    <script src="jexl.min.js"></script>
  </head>
  <body>
    <variables-evaluator jexlpath="jexl"></variables-evaluator>
  </body>
</html>
```

### In a LitElement template

```javascript
import { LitElement, html } from 'lit-element';
import '@advanced-rest-client/variables-evaluator/variables-evaluator.js';

class SampleElement extends LitElement {
  render() {
    return html`
    <variables-evaluator jexl="${this.jexlRef}"></variables-evaluator>
    `;
  }

  async evaluate() {
    const node = this.shadowRoot.querySelector('variables-evaluator');
    // clears previously set context and cache
    node.reset();
    const result = await element.evaluateVariable('some ${str}', {
      str: 'value'
    });
    console.log(result); // some value
  }
}
customElements.define('sample-element', SampleElement);
```

### development

```sh
git clone https://github.com/advanced-rest-client/variables-evaluator
cd variables-evaluator
npm install
```

### Running the demo locally

```sh
npm start
```

### Running the tests

```sh
npm test
```
