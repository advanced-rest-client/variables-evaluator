import { fixture, assert } from '@open-wc/testing';
import * as sinon from 'sinon';
import '../variables-evaluator.js';
import {
  overrideContextPost,
  updgradeLegacy,
  prepareValue,
  applyArgumentsContext,
} from '../src/VariablesMixin.js';
import { EvalFunctions } from '../src/EvalFunctions.js';
import { find, store } from '../src/Cache.js';

/* eslint-disable no-template-curly-in-string */

describe('<variables-evaluator>', () => {
  async function basicFixture() {
    return fixture(
      `<variables-evaluator jexlpath="ArcVariables.JexlDev"></variables-evaluator>`
    );
  }

  describe('reset()', () => {
    let element;
    beforeEach(async () => {
      element = await basicFixture();
      element.context = {};
    });

    it('clears context', () => {
      element.reset();
      assert.isUndefined(element.context);
    });

    it('calls clearCache()', () => {
      const spy = sinon.spy(element, 'clearCache');
      element.reset();
      assert.isTrue(spy.called);
    });
  });

  describe('clearCache()', () => {
    let element;
    beforeEach(async () => {
      element = await basicFixture();
      element.context = {};
    });

    it('removes cached values', () => {
      store(element, 'key', 'group', 'value');
      element.clearCache();
      const result = find(element, 'key', 'group');
      assert.equal(result, null);
    });
  });

  describe('_setupJexl()', () => {
    let element;
    beforeEach(async () => {
      element = await basicFixture();
    });

    afterEach(() => {
      // @ts-ignore
      delete window.varTestObj;
    });

    it('returns undefined when no jexlPath', () => {
      element.jexlPath = undefined;
      const result = element._setupJexl();
      assert.equal(result, null);
    });

    it('returns reference to a window object: no parts in path', () => {
      // @ts-ignore
      window.varTestObj = {};
      element.jexlPath = 'varTestObj';
      const result = element._setupJexl();
      // @ts-ignore
      assert.isTrue(result === window.varTestObj);
    });

    it('returns reference to a window object: parts in path', () => {
      // @ts-ignore
      window.varTestObj = {
        path: {
          to: {
            jexl: {},
          },
        },
      };
      element.jexlPath = 'varTestObj.path.to.jexl';
      const result = element._setupJexl();
      // @ts-ignore
      assert.isTrue(result === window.varTestObj.path.to.jexl);
    });

    it('returns undefined when the path is incorrect', () => {
      // @ts-ignore
      window.varTestObj = {
        path: {},
      };
      element.jexlPath = 'varTestObj.path.to.jexl';
      const result = element._setupJexl();
      assert.equal(result, null);
    });
  });

  describe('_evalFunctions()', () => {
    let element;
    beforeEach(async () => {
      element = await basicFixture();
    });

    it('Returns empty string when no argument', () => {
      const result = element._evalFunctions();
      assert.equal(result, '');
    });

    it('Should call now()', () => {
      const result = element._evalFunctions('now()');
      assert.isFalse(Number.isNaN(result));
    });

    it('Should call random()', () => {
      const result = element._evalFunctions('random()');
      assert.isFalse(Number.isNaN(result));
    });

    it('random() with groups', () => {
      const result = element._evalFunctions('random(1) random(2) random(1)');
      const items = result.split(' ');
      assert.equal(items[0], items[2]);
    });

    it('Calls Math function', () => {
      const result = element._evalFunctions('test Math.abs(-110)');
      assert.equal(result, 'test 110');
    });

    it('Calls String function', () => {
      const result = element._evalFunctions('test String.toLowerCase(TEST)');
      assert.equal(result, 'test test');
    });

    it('Calls encodeURIComponent()', () => {
      const result = element._evalFunctions('test encodeURIComponent(te s+t)');
      assert.equal(result, 'test te%20s%2Bt');
    });

    it('Calls decodeURIComponent()', () => {
      const result = element._evalFunctions(
        'test decodeURIComponent(te%20s%2Bt)'
      );
      assert.equal(result, 'test te s+t');
    });
  });

  describe('_callFn()', () => {
    let element;
    beforeEach(async () => {
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

    it('Calls EvalFunctions.EncodeURIComponent() function', () => {
      const spy = sinon.spy(EvalFunctions, 'EncodeURIComponent');
      element._callFn('encodeURIComponent', ['a']);
      assert.isTrue(spy.called);
      spy.restore();
    });

    it('Calls EvalFunctions.DecodeURIComponent() function', () => {
      const spy = sinon.spy(EvalFunctions, 'DecodeURIComponent');
      element._callFn('decodeURIComponent', ['a']);
      assert.isTrue(spy.called);
      spy.restore();
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

  describe('_callNamespace() =>', () => {
    let element;
    beforeEach(async () => {
      element = await basicFixture();
    });

    it('Returns empty string when namespace does not exist', () => {
      const result = element._callNamespaceFunction('Something', 'fn', []);
      assert.equal(result, '');
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
      const result = element._callNamespaceFunction('String', 'substr', [
        'test',
        1,
      ]);
      assert.equal(result, 'est');
    });

    it('Throws when String function has no arguments', () => {
      assert.throws(() => {
        element._callNamespaceFunction('String', 'substr');
      });
    });
  });

  describe('buildContext()', () => {
    let element;

    const contextFactory = e => {
      e.preventDefault();
      e.detail.variables = [
        {
          variable: 'test1',
          value: 'value1',
          enabled: true,
        },
        {
          variable: 'test2',
          value: 'value2 ${test1}',
          enabled: true,
        },
        {
          variable: 'test3',
          value: 'value3 ${test4}',
          enabled: true,
        },
        {
          variable: 'test4',
          value: 'value4',
          enabled: true,
        },
        {
          variable: 'test5',
          value: 'value5',
          enabled: false,
        },
      ];
    };

    before(() => {
      window.addEventListener('environment-current', contextFactory);
    });

    after(() => {
      window.removeEventListener('environment-current', contextFactory);
    });

    beforeEach(async () => {
      element = await basicFixture();
    });

    it('Should create a context', () => {
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
        test2: 'ov2',
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
        newVar: 'new',
      };
      const context = await element.buildContext(opts);
      assert.equal(context.test1, 'ov1');
      assert.equal(context.test2, 'ov2');
      assert.equal(context.newVar, 'new');
    });
  });

  describe('updgradeLegacy()', () => {
    it('Upgrades ${now}', () => {
      assert.equal(updgradeLegacy('test ${now}'), 'test ${now()}');
    });

    it('Upgrades ${now} with groups', () => {
      assert.equal(updgradeLegacy('test ${now:1}'), 'test ${now(1)}');
    });

    it('Upgrades ${random}', () => {
      assert.equal(updgradeLegacy('test ${random}'), 'test ${random()}');
    });

    it('Upgrades ${random} with groups', () => {
      assert.equal(updgradeLegacy('test ${random:1}'), 'test ${random(1)}');
    });
  });

  describe('prepareValue()', () => {
    it('Prepares simple string', () => {
      assert.equal(prepareValue('test'), 'test');
    });

    it('Prepares string with variable', () => {
      assert.equal(prepareValue('test ${val}'), "'test ' + val + ''");
    });

    it('Throws error for bad syntax', () => {
      assert.throws(() => {
        prepareValue('test ${val');
      }, Error);
    });

    it('Prepares string with complex structure', () => {
      const result = prepareValue('test ${val} test ${val} test ${val}');
      const compare = "'test ' + val + ' test ' + val + ' test ' + val + ''";
      assert.equal(result, compare);
    });
  });

  describe('evaluateVariable()', () => {
    let element;
    const contextFactory = e => {
      e.preventDefault();
      e.detail.variables = [
        {
          variable: 'test1',
          value: 'value1',
          enabled: true,
        },
        {
          variable: 'test2',
          value: 'value2 ${test1}',
          enabled: true,
        },
        {
          variable: 'test3',
          value: 'value3 ${test4}',
          enabled: true,
        },
        {
          variable: 'test4',
          value: 'value4',
          enabled: true,
        },
        {
          variable: 'test5',
          value: 'value5',
          enabled: false,
        },
      ];
    };

    before(() => {
      window.addEventListener('environment-current', contextFactory);
    });

    after(() => {
      window.removeEventListener('environment-current', contextFactory);
    });

    beforeEach(async () => {
      element = await basicFixture();
    });

    it('Should return promise', () => {
      assert.typeOf(element.evaluateVariable('test'), 'promise');
    });

    it('Should return the same string without variables', () => {
      return element.evaluateVariable('test').then(result => {
        assert.equal(result, 'test');
      });
    });

    it('Should return value for variable', () => {
      return element.evaluateVariable('test ${test1}').then(result => {
        assert.equal(result, 'test value1');
      });
    });

    it('Evaluates JSON string', () => {
      const str = '{\n"v1":"${test1}",\n\t"v2": "${test2}"\n}';
      return element.evaluateVariable(str).then(result => {
        assert.equal(result, '{\n"v1":"value1",\n\t"v2": "value2 value1"\n}');
      });
    });

    it('Should return value for complex variable', () => {
      return element.evaluateVariable('test ${test3}').then(result => {
        assert.equal(result, 'test value3 value4');
      });
    });

    it('Should use context from arguments', () => {
      return element
        .evaluateVariable('test ${test3}', { test3: 'value3' })
        .then(result => {
          assert.equal(result, 'test value3');
        });
    });

    it('Should evaluate legacy now function', () => {
      return element.evaluateVariable('test ${now}').then(result => {
        const now = result.split(' ')[1];
        assert.isFalse(Number.isNaN(now));
      });
    });

    it('Should evaluate legacy now function with group', () => {
      return element
        .evaluateVariable('${now:1} ${now:2} ${now:1}')
        .then(result => {
          const values = result.split(' ');
          assert.isFalse(Number.isNaN(values[0]));
          assert.equal(values[0], values[2]);
        });
    });

    it('Should evaluate legacy random function', () => {
      return element.evaluateVariable('test ${random}').then(result => {
        const value = result.split(' ')[1];
        assert.isFalse(Number.isNaN(value));
      });
    });

    it('Should evaluate legacy random function with group', () => {
      return element
        .evaluateVariable('${random:1} ${random:2} ${random:1}')
        .then(result => {
          const values = result.split(' ');
          assert.isFalse(Number.isNaN(values[0]));
          assert.equal(values[0], values[2]);
          assert.notEqual(values[1], values[2]);
        });
    });

    it('Should evaluate now()', () => {
      return element.evaluateVariable('test now()').then(result => {
        const now = result.split(' ')[1];
        assert.isFalse(Number.isNaN(now));
      });
    });

    it('Should evaluate now() with group', () => {
      return element.evaluateVariable('now(1) now(2) now(1)').then(result => {
        const values = result.split(' ');
        assert.equal(values[0], values[2]);
      });
    });

    it('Should evaluate random()', () => {
      return element.evaluateVariable('test random()').then(result => {
        const now = result.split(' ')[1];
        assert.isFalse(Number.isNaN(now));
      });
    });

    it('Should evaluate random() with group', () => {
      return element
        .evaluateVariable('random(1) random(2) random(1)')
        .then(result => {
          const values = result.split(' ');
          assert.equal(values[0], values[2]);
        });
    });

    it('Should evaluate Math function', () => {
      return element.evaluateVariable('test Math.abs(-100)').then(result => {
        assert.equal(result, 'test 100');
      });
    });

    it('Should evaluate String function', () => {
      return element
        .evaluateVariable('test String.toUpperCase(test)')
        .then(result => {
          assert.equal(result, 'test TEST');
        });
    });

    it('Should evaluate encodeURIComponent()', () => {
      return element
        .evaluateVariable('test encodeURIComponent(te s+t)')
        .then(result => {
          assert.equal(result, 'test te%20s%2Bt');
        });
    });

    it('Should evaluate decodeURIComponent()', () => {
      return element
        .evaluateVariable('test decodeURIComponent(te%20s%2Bt)')
        .then(result => {
          assert.equal(result, 'test te s+t');
        });
    });

    it('Should reject invalid input', () => {
      return element
        .evaluateVariable('test ${test')
        .then(() => {
          throw new Error('TEST');
        })
        .catch(cause => {
          if (cause.message === 'TEST') {
            throw new Error('Passed invalid value');
          }
        });
    });

    it('Should not evalueate object', () => {
      const obj = { a: 'b' };
      return element.evaluateVariable(obj).then(result => {
        assert.isTrue(obj === result);
      });
    });

    it('Should not evalueate FormData', () => {
      const obj = new FormData();
      return element.evaluateVariable(obj).then(result => {
        assert.isTrue(obj === result);
      });
    });

    it('Should not evalueate Blob', () => {
      const obj = new Blob(['test']);
      return element.evaluateVariable(obj).then(result => {
        assert.isTrue(obj === result);
      });
    });

    it('Should not evalueate null', () => {
      const obj = null;
      return element.evaluateVariable(obj).then(result => {
        assert.isTrue(obj === result);
      });
    });

    it('Should evaluate numbers', () => {
      const obj = 2;
      return element.evaluateVariable(obj).then(result => {
        assert.isTrue(result === '2');
      });
    });

    it('Should evaluate booleans', () => {
      const obj = false;
      return element.evaluateVariable(obj).then(result => {
        assert.isTrue(result === 'false');
      });
    });

    it('Double slash is preserved', () => {
      return element.evaluateVariable('\\\\test\\\\').then(result => {
        assert.equal(result, '\\\\test\\\\');
      });
    });
  });

  describe('evaluateVariables()', () => {
    let element;
    const contextFactory = e => {
      e.preventDefault();
      e.detail.variables = [
        {
          variable: 'test1',
          value: 'value1',
          enabled: true,
        },
        {
          variable: 'test2',
          value: 'value2 ${test1}',
          enabled: true,
        },
        {
          variable: 'test3',
          value: 'value3 ${test4}',
          enabled: true,
        },
        {
          variable: 'test4',
          value: 'value4',
          enabled: true,
        },
        {
          variable: 'test5',
          value: 'value5',
          enabled: false,
        },
      ];
    };
    const obj = {
      var1: '${test1}',
      var2: '${test2}',
      var3: 'test-${test4}',
      var4: 'hello',
    };
    before(() => {
      window.addEventListener('environment-current', contextFactory);
    });

    after(() => {
      window.removeEventListener('environment-current', contextFactory);
    });

    beforeEach(async () => {
      element = await basicFixture();
    });

    it('Returns promise', () => {
      const tmp = { ...obj };
      assert.typeOf(element.evaluateVariables(tmp), 'promise');
    });

    it('Should return the same string without variables', () => {
      const tmp = { ...obj };
      return element.evaluateVariables(tmp, ['var4']).then(result => {
        assert.equal(result.var4, 'hello');
      });
    });

    it('Should evaluate only listed properties', () => {
      const tmp = { ...obj };
      return element.evaluateVariables(tmp, ['var1']).then(result => {
        assert.equal(result.var1, 'value1');
        assert.equal(result.var2, '${test2}');
        assert.equal(result.var3, 'test-${test4}');
        assert.equal(result.var4, 'hello');
      });
    });

    it('Evaluate all properties', () => {
      const tmp = { ...obj };
      return element.evaluateVariables(tmp).then(result => {
        assert.equal(result.var1, 'value1');
        assert.equal(result.var2, 'value2 value1');
        assert.equal(result.var3, 'test-value4');
        assert.equal(result.var4, 'hello');
      });
    });
  });

  describe('before-request event', () => {
    function fire(name, detail, node) {
      const e = new CustomEvent(name, {
        bubbles: true,
        composed: true,
        cancelable: true,
        detail,
      });
      (node || document).dispatchEvent(e);
      return e;
    }

    let element;
    const request = {
      url: 'https://test.com?q=${test1}',
      headers: 'x-test: ${test2}\nx-test2: ${test3}',
      method: '${test3}',
      payload: '${test4}',
    };

    const contextFactory = e => {
      e.preventDefault();
      e.detail.variables = [
        {
          variable: 'test1',
          value: 'value1',
          enabled: true,
        },
        {
          variable: 'test2',
          value: 'value2 ${test1}',
          enabled: true,
        },
        {
          variable: 'test3',
          value: 'value3 ${test4}',
          enabled: true,
        },
        {
          variable: 'test4',
          value: 'value4',
          enabled: true,
        },
        {
          variable: 'test5',
          value: 'value5',
          enabled: false,
        },
      ];
    };

    before(() => {
      window.addEventListener('environment-current', contextFactory);
    });

    after(() => {
      window.removeEventListener('environment-current', contextFactory);
    });

    beforeEach(async () => {
      element = await basicFixture();
    });

    function getRequest(req) {
      const params = req || request;
      const r = { ...params };
      r.promises = [];
      return r;
    }

    it('Should return promise', () => {
      const e = fire('before-request', getRequest());
      assert.typeOf(e.detail.promises[0], 'promise');
    });

    it('Should not be cancelled', () => {
      const e = fire('before-request', getRequest());
      assert.isFalse(e.defaultPrevented);
    });

    it('Should evaluate URL', () => {
      const e = fire('before-request', getRequest());
      return e.detail.promises[0].then(result => {
        assert.equal(result.url, 'https://test.com?q=value1');
      });
    });

    it('Should evaluate headers', () => {
      const e = fire('before-request', getRequest());
      return e.detail.promises[0].then(result => {
        assert.equal(
          result.headers,
          'x-test: value2 value1\nx-test2: value3 value4'
        );
      });
    });

    it('Should evaluate method', () => {
      const e = fire('before-request', getRequest());
      return e.detail.promises[0].then(result => {
        assert.equal(result.method, 'value3 value4');
      });
    });

    it('Should evaluate payload', () => {
      const e = fire('before-request', getRequest());
      return e.detail.promises[0].then(result => {
        assert.equal(result.payload, 'value4');
      });
    });

    it('Should not set payload', () => {
      const r = {
        url: 'https://test.com?q=${test1}',
        headers: 'x-test: ${test2}\nx-test2: ${test3}',
        method: 'GET',
        promises: [],
      };
      const e = fire('before-request', getRequest(r));
      return e.detail.promises[0].then(result => {
        assert.isUndefined(result.payload);
      });
    });

    it('Should not set headers', () => {
      const r = {
        url: 'https://test.com?q=${test1}',
        method: 'GET',
        promises: [],
      };
      const e = fire('before-request', getRequest(r));
      return e.detail.promises[0].then(result => {
        assert.isUndefined(result.headers);
      });
    });

    it('Ignores event when noBeforeRequest', () => {
      element.noBeforeRequest = true;
      const e = fire('before-request', getRequest());
      assert.lengthOf(e.detail.promises, 0);
    });

    it('Ignores event when no promises array', () => {
      const r = getRequest();
      delete r.promises;
      const e = fire('before-request', r);
      assert.isUndefined(e.detail.promises);
    });

    it('Uses variables from request config', () => {
      const r = getRequest();
      r.config = {
        variables: {
          test1: 'other-value',
        },
      };
      const e = fire('before-request', r);
      return e.detail.promises[0].then(result => {
        assert.equal(result.url, 'https://test.com?q=other-value');
      });
    });
  });

  describe('evaluate-variable event', () => {
    function fire(name, detail, node) {
      const e = new CustomEvent(name, {
        bubbles: true,
        composed: true,
        cancelable: true,
        detail,
      });
      (node || document).dispatchEvent(e);
      return e;
    }

    let element;
    const contextFactory = e => {
      e.preventDefault();
      e.detail.variables = [
        {
          variable: 'test1',
          value: 'value1',
          enabled: true,
        },
        {
          variable: 'test2',
          value: 'value2 ${test1}',
          enabled: true,
        },
        {
          variable: 'test3',
          value: 'value3 ${test4}',
          enabled: true,
        },
        {
          variable: 'test4',
          value: 'value4',
          enabled: true,
        },
        {
          variable: 'test5',
          value: 'value5',
          enabled: false,
        },
      ];
    };

    before(() => {
      window.addEventListener('environment-current', contextFactory);
    });

    after(() => {
      window.removeEventListener('environment-current', contextFactory);
    });

    beforeEach(async () => {
      element = await basicFixture();
    });

    it('Returns promise', () => {
      const e = fire('evaluate-variable', { value: 'test' });
      assert.typeOf(e.detail.result, 'promise');
      return e.detail.result;
    });

    it('Cancels the event', () => {
      const e = fire('evaluate-variable', { value: 'test' });
      assert.isTrue(e.defaultPrevented);
      return e.detail.result;
    });

    it('Evaluates variable', () => {
      const e = fire('evaluate-variable', { value: 'test-var ${test2}' });
      return e.detail.result.then(result => {
        assert.equal(result, 'test-var value2 value1');
      });
    });

    it('Evaluates variable with passed context', () => {
      const e = fire('evaluate-variable', {
        value: 'test-var ${test2}',
        context: {
          test2: 'other-context',
        },
      });
      return e.detail.result.then(result => {
        assert.equal(result, 'test-var other-context');
      });
    });

    it('Evaluates variable with override value', () => {
      const e = fire('evaluate-variable', {
        value: 'test-var ${test2}',
        override: {
          test2: 'other-override',
        },
      });
      return e.detail.result.then(result => {
        assert.equal(result, 'test-var other-override');
      });
    });

    it('Handles promise rejection', () => {
      element.evaluateVariable = () => Promise.reject(new Error('test'));
      const e = fire('evaluate-variable', { value: 'test-var ${test2}' });
      return e.detail.result
        .then(() => {
          throw new Error('Should not resolve.');
        })
        .catch(cause => {
          assert.equal(cause.message, 'test');
        });
    });

    it('Ignores cancelled events', () => {
      element._evaluateVariableHandler({
        defaultPrevented: true,
      });
      // If this check is passed then it will throw an error.
    });
  });

  describe('overrideContextPost()', () => {
    it('returns undefined when no argument', () => {
      const result = overrideContextPost();
      assert.isUndefined(result);
    });

    it('returns context when no override argument', () => {
      const context = {
        test: true,
      };
      const result = overrideContextPost(context);
      assert.deepEqual(result, context);
    });

    it('overrides context values', () => {
      const context = {
        test: true,
        value: 'my-value',
      };
      const override = {
        value: 'other-value',
      };
      const result = overrideContextPost(context, override);
      assert.deepEqual(result, {
        test: true,
        value: 'other-value',
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
        a: 'b',
      });
      assert.deepEqual(result, {
        a: 'b',
      });
    });

    it('calls _processContextVariables with arguments', async () => {
      const spy = sinon.spy(element, '_processContextVariables');
      await element._processContextVariablesPost({
        a: 'b',
      });
      assert.deepEqual(spy.args[0][1], [
        {
          variable: 'a',
          value: 'b',
        },
      ]);
    });
  });

  describe('_applyArgumentsContext()', () => {
    it('returns the same string if not a variable', () => {
      const result = applyArgumentsContext('test', {});
      assert.equal(result, 'test');
    });

    it('replaces value with context value', () => {
      const result = applyArgumentsContext('${test}', {
        test: 'other',
      });
      assert.equal(result, 'other');
    });

    it('returns expression value if no key in context', () => {
      const result = applyArgumentsContext('${test}', {});
      assert.equal(result, 'test');
    });
  });

  describe('a11y', () => {
    it('asses accesssibility tests', async () => {
      const element = await basicFixture();
      await assert.isAccessible(element);
    });
  });
});
