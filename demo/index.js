import { html } from 'lit-html';
import { DemoPage } from '@advanced-rest-client/arc-demo-helper';
import '@anypoint-web-components/anypoint-button/anypoint-button.js';
import '../variables-evaluator.js';

class ComponentDemo extends DemoPage {
  constructor() {
    super();
    this.initObservableProperties([
      'vars', 'oVars', 'val', 'url', 'method', 'headers', 'payload', 'useEventsApi'
    ]);
    this.componentName = 'variables-evaluator';
    let vars = 'variable: my test value\notherVariable: other value\n';
    vars += 'urlParam: query\nurlParamValue: my+query\n';
    vars += 'token: my-access-token\nterm: PUT\n';
    vars += 'complex: ?${urlParam}=${urlParamValue}\n';
    vars += 'doubleComplex: ${complex}&limit=100';
    this._vars = vars;
    this._oVars = 'otherVariable: updated value';
    let val = '{\n';
    val += '  "hello-world": "${variable} ${otherVariable}",\n';
    val += '  "regex1": "^([\\\\w][\\\\w\\\\s\\\\-]*[\\\\w]|[\\\\w])$",\n';
    val += '  "function": "now()",\n';
    val += '  "random": "random()",\n';
    val += '  "group1": "${random(1)}",\n';
    val += '  "group2": "${random(2)}",\n';
    val += '  "group1again": "${random(1)}",\n';
    val += '}';
    this._val = val;
    this._url = 'https://api.domain.com/query${doubleComplex}';
    this._method = '${term}';
    let headers = 'authorization: bearer ${token}\n';
    headers += 'content-type: application/json';
    this._headers = headers;
    this._payload = val;

    this._varsInput = this._inputHandler.bind(this, 'vars');
    this._oVarsHandler = this._inputHandler.bind(this, 'oVars');
    this._valHandler = this._inputHandler.bind(this, 'val');
    this._urlHandler = this._inputHandler.bind(this, 'url');
    this._methodHandler = this._inputHandler.bind(this, 'method');
    this._headersHandler = this._inputHandler.bind(this, 'headers');
    this._payloadHandler = this._inputHandler.bind(this, 'payload');
    this._evalHandler = this._evalHandler.bind(this);
    this._useEventHandler = this._useEventHandler.bind(this);
    this._envRequestHandler = this._envRequestHandler.bind(this);
    window.addEventListener('environment-current', this._envRequestHandler);
  }

  get evalResult() {
    return this._evalResult;
  }

  set evalResult(value) {
    this._setObservableProperty('evalResult', value);
  }

  _inputHandler(property, e) {
    this[property] = e.target.value;
  }

  _evalHandler() {
    if (this.useEventsApi) {
      this._evalEvent();
    } else {
      this._evalImperative();
    }
  }

  async _evalImperative() {
    const element = document.getElementById('evaluator');
    element.reset();
    try {
      const result = await element.evaluateVariable(this.val, undefined, this.processOverrideString(this.oVars));
      console.log(result);
      this.evalResult = result;
    } catch (cause) {
      this.evalResult = cause.message;
      console.error(cause);
    }
  }

  async _evalEvent() {
    const e = new CustomEvent('before-request', {
      bubbles: true,
      detail: {
        url: this.url,
        method: this.method,
        headers: this.headers,
        payload: this.payload,
        promises: []
      }
    });
    document.body.dispatchEvent(e);
    const result = await e.detail.promises[0];
    delete result.promises;
    this.evalResult = JSON.stringify(result, null, 2);
  }

  _useEventHandler(e) {
    this.useEventsApi = e.target.checked;
  }

  _envRequestHandler(e) {
    e.preventDefault();
    e.stopPropagation();
    e.detail.variables = this.processVarString(this.vars);
    e.detail.environment = 'default';
  }

  processVarString(str) {
    const result = [];
    str.split('\n').forEach((line) => {
      line = line.trim();
      if (!line) {
        return;
      }
      const parts = line.split(':');
      const _data = {
        variable: parts[0].trim(),
        enabled: true,
        value: ''
      };
      if (parts[1]) {
        _data.value = parts[1].trim();
      }
      result.push(_data);
    });
    return result;
  }

  processOverrideString(str) {
    const result = {};
    str.split('\n').forEach((line) => {
      line = line.trim();
      if (!line) {
        return;
      }
      const parts = line.split(':');
      const name = parts[0].trim();
      const value = parts[1] ? parts[1].trim() : '';
      result[name] = value;
    });
    return result;
  }

  contentTemplate() {
    const { evalResult, val, vars, oVars, useEventsApi, url, method, headers, payload } = this;
    return html`
    <variables-evaluator id="evaluator" jexlpath="ArcVariables.JexlDev"></variables-evaluator>

    <fieldset class="card">
      <legend>Input data</legend>
      <div>
        <label for="vars" id="varsLabel">Variables</label>
        <p class="desc" id="varsDesc">
          Add variables in each line using ":" as a delimiter between name and the value.
          This variables are going to be used in events API (environment-current event)
        </p>
        <textarea
          name="variables"
          id="vars"
          rows="8"
          cols="60"
          aria-labelledby="varsLabel"
          aria-describedby="varsDesc"
          .value="${vars}"
          @input="${this._varsInput}"></textarea>
      </div>

      <div>
        <label for="oVars" id="overrideLabel">Override variables</label>
        <p class="desc" id="oVarsDesc">
          Variables defined here will be passed to eval function to override variables from previous input
        </p>
        <textarea
          name="variables"
          id="oVars"
          rows="8"
          cols="60"
          aria-labelledby="overrideLabel"
          aria-describedby="oVarsDesc"
          .value="${oVars}"
          @input="${this._oVarsHandler}"></textarea>
      </div>
      <div>
        <label>
          <input type="checkbox" id="evalEvent" @change="${this._useEventHandler}" />
          Evaluate in "before-request" event
        </label>
        <p>Uses events API instead of imperative API</p>
      </div>

      ${useEventsApi ?
        html`<div>
          <label for="urlInput" id="urlLabel">Request URL</label>
          <p class="desc" id="urlDesc">
            An URL of the request
          </p>
          <input
            name="url"
            type="url"
            id="urlInput"
            aria-labelledby="urlLabel"
            aria-describedby="urlDesc"
            .value="${url}"
            @input="${this._urlHandler}"/>
        </div>
        <div>
          <label for="methodInput" id="methodLabel">Request method</label>
          <p class="desc" id="methodDesc">
            Request term
          </p>
          <input
            list="terms"
            name="method"
            type="text"
            id="methodInput"
            aria-labelledby="methodLabel"
            aria-describedby="methodDesc"
            .value="${method}"
            @input="${this._methodHandler}"/>

          <datalist id="terms">
            <option value="GET">
            <option value="POST">
            <option value="PUT">
            <option value="DELETE">
            <option value="HEAD">
          </datalist>
        </div>
        <div>
          <label for="headersInput" id="headersLabel">Headers</label>
          <p class="desc" id="headersDesc">
            Request headers
          </p>
          <textarea
            name="headers"
            id="headersInput"
            rows="8"
            cols="60"
            aria-labelledby="headersLabel"
            aria-describedby="headersDesc"
            .value="${headers}"
            @input="${this._headersHandler}"></textarea>
        </div>
        <div>
          <label for="payloadInput" id="payloadLabel">Payload</label>
          <p class="desc" id="payloadDesc">
            Request body
          </p>
          <textarea
            name="payload"
            id="payloadInput"
            rows="8"
            cols="60"
            aria-labelledby="payloadLabel"
            aria-describedby="payloadDesc"
            .value="${payload}"
            @input="${this._payloadHandler}"></textarea>
        </div>` :
        html`<div>
          <label for="vars" id="varsLabel">Value</label>
          <p class="desc" id="varsDesc">Enter a text to be evaluated for variables</p>
          <textarea
            name="textvalue"
            id="val"
            rows="8"
            cols="60"
            aria-labelledby="valLabel"
            aria-describedby="valDesc"
            .value="${val}"
            @input="${this._valHandler}"></textarea>
        </div>`}
      <anypoint-button emphasis="high" @click="${this._evalHandler}">Evaluate</anypoint-button>
    </fieldset>

    <div class="card">
      <h2>Eval result</h2>
      ${evalResult ?
        html`<output>${evalResult}</output>` :
        html`<p class="empty-info">Evaluate the value to see the result.</p>`}
    </div>
    `;
  }
}
const instance = new ComponentDemo();
instance.render();
window.demo = instance;
