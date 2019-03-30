[![Published on NPM](https://img.shields.io/npm/v/@advanced-rest-client/variables-evaluator.svg)](https://www.npmjs.com/package/@advanced-rest-client/variables-evaluator)

[![Build Status](https://travis-ci.org/advanced-rest-client/variables-evaluator.svg?branch=stage)](https://travis-ci.org/advanced-rest-client/variables-evaluator)

[![Published on webcomponents.org](https://img.shields.io/badge/webcomponents.org-published-blue.svg)](https://www.webcomponents.org/element/advanced-rest-client/variables-evaluator)

## &lt;variables-evaluator&gt;

Variables evaluator for the Advanced REST Client and API components.

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
      import './node_odules/@advanced-rest-client/variables-evaluator/variables-evaluator.js';
    </script>
  </head>
  <body>
    <variables-evaluator value="2"></variables-evaluator>
  </body>
</html>
```

### In a Polymer 3 element

```js
import {PolymerElement, html} from './node_odules/@polymer/polymer';
import './node_odules/@advanced-rest-client/variables-evaluator/variables-evaluator.js';

class SampleElement extends PolymerElement {
  static get template() {
    return html`
    <variables-evaluator></variables-evaluator>
    `;
  }
}
customElements.define('sample-element', SampleElement);
```

### Installation

```sh
git clone https://github.com/advanced-rest-client/variables-evaluator
cd api-url-editor
npm install
npm install -g polymer-cli
```

### Running the demo locally

```sh
polymer serve --npm
open http://127.0.0.1:<port>/demo/
```

### Running the tests
```sh
polymer test --npm
```
