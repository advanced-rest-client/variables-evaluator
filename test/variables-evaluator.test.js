import { fixture, assert } from '@open-wc/testing';
import sinon from 'sinon/pkg/sinon-esm.js';
import '../variables-evaluator.js';

describe('<variables-evaluator>', function() {
  async function basicFixture() {
    return await fixture(`<variables-evaluator jexlpath="ArcVariables.JexlDev"></variables-evaluator>`);
  }

  describe('reset()', () => {
    let element;
    beforeEach(async function() {
      element = await basicFixture();
      element.context = {};
      element.cache = {};
    });

    it('clears context', function() {
      element.reset();
      assert.isUndefined(element.context);
    });

    it('clears cache', function() {
      element.reset();
      assert.isUndefined(element.cache);
    });
  });

  describe('_setupJexl()', () => {
    let element;
    beforeEach(async function() {
      element = await basicFixture();
    });

    afterEach(() => {
      delete window.varTestObj;
    });

    it('returns undefined when no jexlPath', function() {
      element.jexlPath = undefined;
      const result = element._setupJexl();
      assert.isUndefined(result);
    });

    it('returns reference to a window object: no parts in path', function() {
      window.varTestObj = {};
      element.jexlPath = 'varTestObj';
      const result = element._setupJexl();
      assert.isTrue(result === window.varTestObj);
    });

    it('returns reference to a window object: parts in path', function() {
      window.varTestObj = {
        path: {
          to: {
            jexl: {}
          }
        }
      };
      element.jexlPath = 'varTestObj.path.to.jexl';
      const result = element._setupJexl();
      assert.isTrue(result === window.varTestObj.path.to.jexl);
    });

    it('returns undefined when the path is incorrect', function() {
      window.varTestObj = {
        path: {}
      };
      element.jexlPath = 'varTestObj.path.to.jexl';
      const result = element._setupJexl();
      assert.isUndefined(result);
    });
  });

  describe('_evalFunctions()', function() {
    let element;
    beforeEach(async function() {
      element = await basicFixture();
    });

    it('Returns undefined when no argument', function() {
      const result = element._evalFunctions();
      assert.isUndefined(result);
    });

    it('Should call now()', function() {
      const result = element._evalFunctions('now()');
      assert.isFalse(isNaN(result));
    });

    it('Should call random()', function() {
      const result = element._evalFunctions('random()');
      assert.isFalse(isNaN(result));
    });

    it('random() with groups', function() {
      const result = element._evalFunctions('random(1) random(2) random(1)');
      const items = result.split(' ');
      assert.equal(items[0], items[2]);
    });

    it('Calls Math function', function() {
      const result = element._evalFunctions('test Math.abs(-110)');
      assert.equal(result, 'test 110');
    });

    it('Calls String function', function() {
      const result = element._evalFunctions('test String.toLowerCase(TEST)');
      assert.equal(result, 'test test');
    });

    it('Calls encodeURIComponent()', function() {
      const result = element._evalFunctions('test encodeURIComponent(te s+t)');
      assert.equal(result, 'test te%20s%2Bt');
    });

    it('Calls decodeURIComponent()', function() {
      const result = element._evalFunctions('test decodeURIComponent(te%20s%2Bt)');
      assert.equal(result, 'test te s+t');
    });
  });

  describe('_callFn()', function() {
    let element;
    beforeEach(async function() {
      element = await basicFixture();
    });

    it('Throws when function do not exists', () => {
      assert.throws(() => {
        element._callFn('nonExisting');
      });
    });

    it('Throws when namespace function do not exists', () => {
      assert.throws(() => {
        element._callFn('Something.nonExisting');
      });
    });

    it('Calls now() function', () => {
      const spy = sinon.spy(element, '__evalFnNow');
      element._callFn('now');
      assert.isTrue(spy.called);
    });

    it('Calls random() function', () => {
      const spy = sinon.spy(element, '__evalFnRandom');
      element._callFn('random');
      assert.isTrue(spy.called);
    });

    it('Calls encodeURIComponent() function', () => {
      const spy = sinon.spy(element, '__evalFnEncodeURIComponent');
      element._callFn('encodeURIComponent', ['a']);
      assert.isTrue(spy.called);
    });

    it('Calls decodeURIComponent() function', () => {
      const spy = sinon.spy(element, '__evalFnDecodeURIComponent');
      element._callFn('decodeURIComponent', ['a']);
      assert.isTrue(spy.called);
    });

    it('Calls Math.xxx() function', () => {
      const spy = sinon.spy(element, '_callNamespaceFunction');
      element._callFn('Math.abs', [1]);
      assert.isTrue(spy.called);
      assert.equal(spy.args[0][0], 'Math', 'namespace is set');
      assert.equal(spy.args[0][1], 'abs', 'function name is set');
      assert.deepEqual(spy.args[0][2], [1], 'arguments is set');
    });

    it('Calls String.xxx() function', () => {
      const spy = sinon.spy(element, '_callNamespaceFunction');
      element._callFn('String.substr', ['test', 1]);
      assert.isTrue(spy.called);
      assert.equal(spy.args[0][0], 'String', 'namespace is set');
      assert.equal(spy.args[0][1], 'substr', 'function name is set');
      assert.typeOf(spy.args[0][2], 'array', 'arguments is set');
    });

    it('Calls JSON.xxx() function', () => {
      const spy = sinon.spy(element, '_callNamespaceFunction');
      element._callFn('JSON.parse', ['{}']);
      assert.isTrue(spy.called);
      assert.equal(spy.args[0][0], 'JSON', 'namespace is set');
      assert.equal(spy.args[0][1], 'parse', 'function name is set');
      assert.deepEqual(spy.args[0][2], ['{}'], 'arguments is set');
    });
  });

  describe('_callNamespaceFunction()', () => {
    let element;
    beforeEach(async function() {
      element = await basicFixture();
    });

    it('Returns undefined when namespace does not exist', () => {
      const result = element._callNamespaceFunction('Something', 'fn', []);
      assert.isUndefined(result);
    });

    it('Calls Math function', () => {
      const result = element._callNamespaceFunction('Math', 'abs', [1]);
      assert.equal(result, 1);
    });

    it('Calls JSON function', () => {
      const result = element._callNamespaceFunction('JSON', 'stringify', [{}]);
      assert.equal(result, '{}');
    });

    it('Calls String function', () => {
      const result = element._callNamespaceFunction('String', 'substr', ['test', 1]);
      assert.equal(result, 'est');
    });

    it('Throws when String function has no arguments', () => {
      assert.throws(() => {
        element._callNamespaceFunction('String', 'substr');
      });
    });
  });

  describe('buildContext()', function() {
    let element;

    const contextFactory = function(e) {
      e.preventDefault();
      e.detail.variables = [{
        variable: 'test1',
        value: 'value1',
        enabled: true
      }, {
        variable: 'test2',
        value: 'value2 ${test1}',
        enabled: true
      }, {
        variable: 'test3',
        value: 'value3 ${test4}',
        enabled: true
      }, {
        variable: 'test4',
        value: 'value4',
        enabled: true
      }, {
        variable: 'test5',
        value: 'value5',
        enabled: false
      }];
    };

    before(function() {
      window.addEventListener('environment-current', contextFactory);
    });

    after(function() {
      window.removeEventListener('environment-current', contextFactory);
    });

    beforeEach(async function() {
      element = await basicFixture();
    });

    it('Should create a context', function() {
      return element.buildContext();
    });

    it('Returns empty object when event is not handled', async () => {
      element.addEventListener('environment-current', function f(e) {
        element.removeEventListener('environment-current', f);
        e.stopPropagation();
      });
      const result = await element.buildContext();
      assert.typeOf(result, 'object');
      assert.lengthOf(Object.keys(result), 0);
    });

    it('Returns empty object when variables are not set', async () => {
      element.addEventListener('environment-current', function f(e) {
        element.removeEventListener('environment-current', f);
        e.stopPropagation();
        e.preventDefault();
      });
      const result = await element.buildContext();
      assert.typeOf(result, 'object');
      assert.lengthOf(Object.keys(result), 0);
    });

    it('Returns empty object when has no variables', async () => {
      element.addEventListener('environment-current', function f(e) {
        element.removeEventListener('environment-current', f);
        e.stopPropagation();
        e.preventDefault();
        e.detail.variables = [];
      });
      const result = await element.buildContext();
      assert.typeOf(result, 'object');
      assert.lengthOf(Object.keys(result), 0);
    });

    it('Sets variable value', async () => {
      const context = await element.buildContext();
      assert.equal(context.test2, 'value2 value1');
    });

    it('Sets variable value defined later', async () => {
      const context = await element.buildContext();
      assert.equal(context.test3, 'value3 value4');
    });

    it('Do not uses disabled elements', async () => {
      const context = await element.buildContext();
      assert.isUndefined(context.test5);
    });

    it('Override context values', async () => {
      const opts = {
        test1: 'ov1',
        test2: 'ov2'
      };
      const context = await element.buildContext(opts);
      assert.equal(context.test1, 'ov1');
      assert.equal(context.test2, 'ov2');
      assert.equal(context.test3, 'value3 value4');
    });

    it('Adds new context values', async () => {
      const opts = {
        test1: 'ov1',
        test2: 'ov2',
        newVar: 'new'
      };
      const context = await element.buildContext(opts);
      assert.equal(context.test1, 'ov1');
      assert.equal(context.test2, 'ov2');
      assert.equal(context.newVar, 'new');
    });
  });

  describe('_updgradeLegacy()', function() {
    let element;
    beforeEach(async () => {
      element = await basicFixture();
    });

    it('Upgrades ${now}', function() {
      assert.equal(element._updgradeLegacy('test ${now}'), 'test ${now()}');
    });

    it('Upgrades ${now} with groups', function() {
      assert.equal(element._updgradeLegacy('test ${now:1}'), 'test ${now(1)}');
    });

    it('Upgrades ${random}', function() {
      assert.equal(element._updgradeLegacy('test ${random}'), 'test ${random()}');
    });

    it('Upgrades ${random} with groups', function() {
      assert.equal(element._updgradeLegacy('test ${random:1}'), 'test ${random(1)}');
    });
  });

  describe('_prepareValue()', function() {
    let element;
    beforeEach(async () => {
      element = await basicFixture();
    });

    it('Prepares simple string', function() {
      assert.equal(element._prepareValue('test'), 'test');
    });

    it('Prepares string with variable', function() {
      assert.equal(element._prepareValue('test ${val}'), '\'test \' + val + \'\'');
    });

    it('Throws error for bad syntax', function() {
      assert.throws(function() {
        element._prepareValue('test ${val');
      }, Error);
    });

    it('Prepares string with complex structure', function() {
      const result = element._prepareValue('test ${val} test ${val} test ${val}');
      const compare = '\'test \' + val + \' test \' + val + \' test \' + val + \'\'';
      assert.equal(result, compare);
    });
  });

  describe('evaluateVariable()', function() {
    let element;
    const contextFactory = function(e) {
      e.preventDefault();
      e.detail.variables = [{
        variable: 'test1',
        value: 'value1',
        enabled: true
      }, {
        variable: 'test2',
        value: 'value2 ${test1}',
        enabled: true
      }, {
        variable: 'test3',
        value: 'value3 ${test4}',
        enabled: true
      }, {
        variable: 'test4',
        value: 'value4',
        enabled: true
      }, {
        variable: 'test5',
        value: 'value5',
        enabled: false
      }];
    };

    before(function() {
      window.addEventListener('environment-current', contextFactory);
    });

    after(function() {
      window.removeEventListener('environment-current', contextFactory);
    });

    beforeEach(async () => {
      element = await basicFixture();
    });

    it('Should return promise', function() {
      assert.typeOf(element.evaluateVariable('test'), 'promise');
    });

    it('Should return the same string without variables', function() {
      return element.evaluateVariable('test')
      .then(function(result) {
        assert.equal(result, 'test');
      });
    });

    it('Should return value for variable', function() {
      return element.evaluateVariable('test ${test1}')
      .then(function(result) {
        assert.equal(result, 'test value1');
      });
    });

    it('Evaluates JSON string', function() {
      const str = '{\n"v1":"${test1}",\n\t"v2": "${test2}"\n}';
      return element.evaluateVariable(str)
      .then(function(result) {
        assert.equal(result, '{\n"v1":"value1",\n\t"v2": "value2 value1"\n}');
      });
    });

    it('Should return value for complex variable', function() {
      return element.evaluateVariable('test ${test3}')
      .then(function(result) {
        assert.equal(result, 'test value3 value4');
      });
    });

    it('Should use context from arguments', function() {
      return element.evaluateVariable('test ${test3}', {test3: 'value3'})
      .then(function(result) {
        assert.equal(result, 'test value3');
      });
    });

    it('Should evaluate legacy now function', function() {
      return element.evaluateVariable('test ${now}')
      .then(function(result) {
        const now = result.split(' ')[1];
        assert.isFalse(isNaN(now));
      });
    });

    it('Should evaluate legacy now function with group', function() {
      return element.evaluateVariable('${now:1} ${now:2} ${now:1}')
      .then(function(result) {
        const values = result.split(' ');
        assert.isFalse(isNaN(values[0]));
        assert.equal(values[0], values[2]);
      });
    });

    it('Should evaluate legacy random function', function() {
      return element.evaluateVariable('test ${random}')
      .then(function(result) {
        const value = result.split(' ')[1];
        assert.isFalse(isNaN(value));
      });
    });

    it('Should evaluate legacy random function with group', function() {
      return element.evaluateVariable('${random:1} ${random:2} ${random:1}')
      .then(function(result) {
        const values = result.split(' ');
        assert.isFalse(isNaN(values[0]));
        assert.equal(values[0], values[2]);
        assert.notEqual(values[1], values[2]);
      });
    });

    it('Should evaluate now()', function() {
      return element.evaluateVariable('test now()')
      .then(function(result) {
        const now = result.split(' ')[1];
        assert.isFalse(isNaN(now));
      });
    });

    it('Should evaluate now() with group', function() {
      return element.evaluateVariable('now(1) now(2) now(1)')
      .then(function(result) {
        const values = result.split(' ');
        assert.equal(values[0], values[2]);
      });
    });

    it('Should evaluate random()', function() {
      return element.evaluateVariable('test random()')
      .then(function(result) {
        const now = result.split(' ')[1];
        assert.isFalse(isNaN(now));
      });
    });

    it('Should evaluate random() with group', function() {
      return element.evaluateVariable('random(1) random(2) random(1)')
      .then(function(result) {
        const values = result.split(' ');
        assert.equal(values[0], values[2]);
      });
    });

    it('Should evaluate Math function', function() {
      return element.evaluateVariable('test Math.abs(-100)')
      .then(function(result) {
        assert.equal(result, 'test 100');
      });
    });

    it('Should evaluate String function', function() {
      return element.evaluateVariable('test String.toUpperCase(test)')
      .then(function(result) {
        assert.equal(result, 'test TEST');
      });
    });

    it('Should evaluate encodeURIComponent()', function() {
      return element.evaluateVariable('test encodeURIComponent(te s+t)')
      .then(function(result) {
        assert.equal(result, 'test te%20s%2Bt');
      });
    });

    it('Should evaluate decodeURIComponent()', function() {
      return element.evaluateVariable('test decodeURIComponent(te%20s%2Bt)')
      .then(function(result) {
        assert.equal(result, 'test te s+t');
      });
    });

    it('Should reject invalid input', function() {
      return element.evaluateVariable('test ${test')
      .then(function() {
        throw new Error('TEST');
      })
      .catch(function(cause) {
        if (cause.message === 'TEST') {
          throw new Error('Passed invalid value');
        }
      });
    });

    it('Should not evalueate object', function() {
      const obj = {'a': 'b'};
      return element.evaluateVariable(obj)
      .then(function(result) {
        assert.isTrue(obj === result);
      });
    });

    it('Should not evalueate FormData', function() {
      const obj = new FormData();
      return element.evaluateVariable(obj)
      .then(function(result) {
        assert.isTrue(obj === result);
      });
    });

    it('Should not evalueate Blob', function() {
      const obj = new Blob(['test']);
      return element.evaluateVariable(obj)
      .then(function(result) {
        assert.isTrue(obj === result);
      });
    });

    it('Should not evalueate null', function() {
      const obj = null;
      return element.evaluateVariable(obj)
      .then(function(result) {
        assert.isTrue(obj === result);
      });
    });

    it('Should evaluate numbers', function() {
      const obj = 2;
      return element.evaluateVariable(obj)
      .then(function(result) {
        assert.isTrue('2' === result);
      });
    });

    it('Should evaluate booleans', function() {
      const obj = false;
      return element.evaluateVariable(obj)
      .then(function(result) {
        assert.isTrue('false' === result);
      });
    });

    it('Double slash is preserved', function() {
      return element.evaluateVariable('\\\\test\\\\')
      .then(function(result) {
        assert.equal(result, '\\\\test\\\\');
      });
    });
  });

  describe('evaluateVariables()', function() {
    let element;
    const contextFactory = function(e) {
      e.preventDefault();
      e.detail.variables = [{
        variable: 'test1',
        value: 'value1',
        enabled: true
      }, {
        variable: 'test2',
        value: 'value2 ${test1}',
        enabled: true
      }, {
        variable: 'test3',
        value: 'value3 ${test4}',
        enabled: true
      }, {
        variable: 'test4',
        value: 'value4',
        enabled: true
      }, {
        variable: 'test5',
        value: 'value5',
        enabled: false
      }];
    };
    const obj = {
      var1: '${test1}',
      var2: '${test2}',
      var3: 'test-${test4}',
      var4: 'hello'
    };
    before(function() {
      window.addEventListener('environment-current', contextFactory);
    });

    after(function() {
      window.removeEventListener('environment-current', contextFactory);
    });

    beforeEach(async () => {
      element = await basicFixture();
    });

    it('Returns promise', function() {
      const tmp = Object.assign({}, obj);
      assert.typeOf(element.evaluateVariables(tmp), 'promise');
    });

    it('Should return the same string without variables', function() {
      const tmp = Object.assign({}, obj);
      return element.evaluateVariables(tmp, ['var4'])
      .then(function(result) {
        assert.equal(result.var4, 'hello');
      });
    });

    it('Should evaluate only listed properties', function() {
      const tmp = Object.assign({}, obj);
      return element.evaluateVariables(tmp, ['var1'])
      .then(function(result) {
        assert.equal(result.var1, 'value1');
        assert.equal(result.var2, '${test2}');
        assert.equal(result.var3, 'test-${test4}');
        assert.equal(result.var4, 'hello');
      });
    });

    it('Evaluate all properties', function() {
      const tmp = Object.assign({}, obj);
      return element.evaluateVariables(tmp)
      .then(function(result) {
        assert.equal(result.var1, 'value1');
        assert.equal(result.var2, 'value2 value1');
        assert.equal(result.var3, 'test-value4');
        assert.equal(result.var4, 'hello');
      });
    });
  });

  describe('before-request event', function() {
    function fire(name, detail, node) {
      const e = new CustomEvent(name, {
        bubbles: true,
        composed: true,
        cancelable: true,
        detail: detail
      });
      (node || document).dispatchEvent(e);
      return e;
    }

    let element;
    const request = {
      'url': 'https://test.com?q=${test1}',
      'headers': 'x-test: ${test2}\nx-test2: ${test3}',
      'method': '${test3}',
      'payload': '${test4}'
    };

    const contextFactory = function(e) {
      e.preventDefault();
      e.detail.variables = [{
        variable: 'test1',
        value: 'value1',
        enabled: true
      }, {
        variable: 'test2',
        value: 'value2 ${test1}',
        enabled: true
      }, {
        variable: 'test3',
        value: 'value3 ${test4}',
        enabled: true
      }, {
        variable: 'test4',
        value: 'value4',
        enabled: true
      }, {
        variable: 'test5',
        value: 'value5',
        enabled: false
      }];
    };

    before(function() {
      window.addEventListener('environment-current', contextFactory);
    });

    after(function() {
      window.removeEventListener('environment-current', contextFactory);
    });

    beforeEach(async () => {
      element = await basicFixture();
    });

    function getRequest(req) {
      const r = Object.assign({}, req || request);
      r.promises = [];
      return r;
    }

    it('Should return promise', function() {
      const e = fire('before-request', getRequest());
      assert.typeOf(e.detail.promises[0], 'promise');
    });

    it('Should not be cancelled', function() {
      const e = fire('before-request', getRequest());
      assert.isFalse(e.defaultPrevented);
    });

    it('Should evaluate URL', function() {
      const e = fire('before-request', getRequest());
      return e.detail.promises[0]
      .then(function(result) {
        assert.equal(result.url, 'https://test.com?q=value1');
      });
    });

    it('Should evaluate headers', function() {
      const e = fire('before-request', getRequest());
      return e.detail.promises[0]
      .then(function(result) {
        assert.equal(result.headers, 'x-test: value2 value1\nx-test2: value3 value4');
      });
    });

    it('Should evaluate method', function() {
      const e = fire('before-request', getRequest());
      return e.detail.promises[0]
      .then(function(result) {
        assert.equal(result.method, 'value3 value4');
      });
    });

    it('Should evaluate payload', function() {
      const e = fire('before-request', getRequest());
      return e.detail.promises[0]
      .then(function(result) {
        assert.equal(result.payload, 'value4');
      });
    });

    it('Should not set payload', function() {
      const request = {
        url: 'https://test.com?q=${test1}',
        headers: 'x-test: ${test2}\nx-test2: ${test3}',
        method: 'GET',
        promises: []
      };
      const e = fire('before-request', getRequest(request));
      return e.detail.promises[0]
      .then(function(result) {
        assert.isUndefined(result.payload);
      });
    });

    it('Should not set headers', function() {
      const request = {
        url: 'https://test.com?q=${test1}',
        method: 'GET',
        promises: []
      };
      const e = fire('before-request', getRequest(request));
      return e.detail.promises[0]
      .then(function(result) {
        assert.isUndefined(result.headers);
      });
    });

    it('Ignores event when noBeforeRequest', function() {
      element.noBeforeRequest = true;
      const e = fire('before-request', getRequest());
      assert.lengthOf(e.detail.promises, 0);
    });

    it('Ignores event when no promises array', function() {
      const r = getRequest();
      delete r.promises;
      const e = fire('before-request', r);
      assert.isUndefined(e.detail.promises);
    });

    it('Uses variables from request config', function() {
      const request = getRequest();
      request.config = {
        variables: {
          test1: 'other-value'
        }
      };
      const e = fire('before-request', request);
      return e.detail.promises[0]
      .then(function(result) {
        assert.equal(result.url, 'https://test.com?q=other-value');
      });
    });
  });

  describe('evaluate-variable event', function() {
    function fire(name, detail, node) {
      const e = new CustomEvent(name, {
        bubbles: true,
        composed: true,
        cancelable: true,
        detail: detail
      });
      (node || document).dispatchEvent(e);
      return e;
    }

    let element;
    const contextFactory = function(e) {
      e.preventDefault();
      e.detail.variables = [{
        variable: 'test1',
        value: 'value1',
        enabled: true
      }, {
        variable: 'test2',
        value: 'value2 ${test1}',
        enabled: true
      }, {
        variable: 'test3',
        value: 'value3 ${test4}',
        enabled: true
      }, {
        variable: 'test4',
        value: 'value4',
        enabled: true
      }, {
        variable: 'test5',
        value: 'value5',
        enabled: false
      }];
    };

    before(function() {
      window.addEventListener('environment-current', contextFactory);
    });

    after(function() {
      window.removeEventListener('environment-current', contextFactory);
    });

    beforeEach(async () => {
      element = await basicFixture();
    });

    it('Returns promise', function() {
      const e = fire('evaluate-variable', {value: 'test'});
      assert.typeOf(e.detail.result, 'promise');
      return e.detail.result;
    });

    it('Cancels the event', function() {
      const e = fire('evaluate-variable', {value: 'test'});
      assert.isTrue(e.defaultPrevented);
      return e.detail.result;
    });

    it('Evaluates variable', function() {
      const e = fire('evaluate-variable', {value: 'test-var ${test2}'});
      return e.detail.result
      .then(function(result) {
        assert.equal(result, 'test-var value2 value1');
      });
    });

    it('Evaluates variable with passed context', function() {
      const e = fire('evaluate-variable', {
        value: 'test-var ${test2}',
        context: {
          test2: 'other-context'
        }
      });
      return e.detail.result
      .then(function(result) {
        assert.equal(result, 'test-var other-context');
      });
    });

    it('Evaluates variable with override value', function() {
      const e = fire('evaluate-variable', {
        value: 'test-var ${test2}',
        override: {
          test2: 'other-override'
        }
      });
      return e.detail.result
      .then(function(result) {
        assert.equal(result, 'test-var other-override');
      });
    });

    it('Handles promise rejection', function() {
      element.evaluateVariable = () => Promise.reject(new Error('test'));
      const e = fire('evaluate-variable', {value: 'test-var ${test2}'});
      return e.detail.result
      .then(function() {
        throw new Error('Should not resolve.');
      })
      .catch((cause) => {
        assert.equal(cause.message, 'test');
      });
    });

    it('Ignores cancelled events', () => {
      element._evaluateVariableHandler({
        defaultPrevented: true
      });
      // If this check is passed then it will throw an error.
    });
  });

  describe('_overrideContextPost()', () => {
    let element;
    beforeEach(async () => {
      element = await basicFixture();
    });

    it('returns undefined when no argument', () => {
      const result = element._overrideContextPost();
      assert.isUndefined(result);
    });

    it('returns context when no override argument', () => {
      const context = {
        test: true
      };
      const result = element._overrideContextPost(context);
      assert.deepEqual(result, context);
    });

    it('overrides context values', () => {
      const context = {
        test: true,
        value: 'my-value'
      };
      const override = {
        value: 'other-value'
      };
      const result = element._overrideContextPost(context, override);
      assert.deepEqual(result, {
        test: true,
        value: 'other-value'
      });
    });
  });

  describe('_processContextVariablesPost()', () => {
    let element;
    beforeEach(async () => {
      element = await basicFixture();
    });

    it('returns an object', async () => {
      const result = await element._processContextVariablesPost({
        a: 'b'
      });
      assert.deepEqual(result, {
        a: 'b'
      });
    });

    it('calls _processContextVariables with arguments', async () => {
      const spy = sinon.spy(element, '_processContextVariables');
      await element._processContextVariablesPost({
        a: 'b'
      });
      assert.deepEqual(spy.args[0][1], [{
        variable: 'a',
        value: 'b'
      }]);
    });
  });

  describe('_applyArgumentsContext()', () => {
    let element;
    beforeEach(async () => {
      element = await basicFixture();
    });

    it('returns the same string if not a variable', () => {
      const result = element._applyArgumentsContext('test', {});
      assert.equal(result, 'test');
    });

    it('replaces value with context value', () => {
      const result = element._applyArgumentsContext('${test}', {
        test: 'other'
      });
      assert.equal(result, 'other');
    });

    it('returns expression value if no key in context', () => {
      const result = element._applyArgumentsContext('${test}', {});
      assert.equal(result, 'test');
    });
  });

  describe('__evalFnEncodeURIComponent()', () => {
    let element;
    beforeEach(async () => {
      element = await basicFixture();
    });

    it('throws when no argument', () => {
      assert.throws(() => {
        element.__evalFnEncodeURIComponent();
      });
    });

    it('throws when first array item is empty', () => {
      assert.throws(() => {
        element.__evalFnEncodeURIComponent([]);
      });
    });

    it('encodes passed value', () => {
      const result = element.__evalFnEncodeURIComponent(['a b']);
      assert.equal(result, 'a%20b');
    });
  });

  describe('__evalFnDecodeURIComponent()', () => {
    let element;
    beforeEach(async () => {
      element = await basicFixture();
    });

    it('throws when no argument', () => {
      assert.throws(() => {
        element.__evalFnDecodeURIComponent();
      });
    });

    it('throws when first array item is empty', () => {
      assert.throws(() => {
        element.__evalFnDecodeURIComponent([]);
      });
    });

    it('decodes passed value', () => {
      const result = element.__evalFnDecodeURIComponent(['a%20b']);
      assert.equal(result, 'a b');
    });
  });

  describe('a11y', () => {
    it('asses accesssibility tests', async () => {
      const element = await basicFixture();
      await assert.isAccessible(element);
    });
  });
});
