import { assert } from '@open-wc/testing';
import * as sinon from 'sinon';
import { VariablesMixin, EvalFunctions } from '../index.js';
import { find, store } from '../src/Cache.js';

/* eslint-disable no-template-curly-in-string */

class VariablesClass extends VariablesMixin(Object) {
  constructor(opts = {}) {
    super();
    this.context = opts.context;
    this.jexlPath = opts.jexlPath;
    this.jexl = opts.jexl;
  }

  dispatchEvent(e) {
    window.dispatchEvent(e);
  }
}

describe('VariablesMixin', () => {
  describe('reset()', () => {
    let instance;
    beforeEach(async () => {
      instance = new VariablesClass({
        jexlPath: 'ArcVariables.JexlDev',
        context: {},
      });
    });

    it('clears context', () => {
      instance.reset();
      assert.isUndefined(instance.context);
    });

    it('calls clearCache()', () => {
      const spy = sinon.spy(instance, 'clearCache');
      instance.reset();
      assert.isTrue(spy.called);
    });
  });

  describe('clearCache()', () => {
    let instance;
    beforeEach(async () => {
      instance = new VariablesClass({
        jexlPath: 'ArcVariables.JexlDev',
        context: {},
      });
    });

    it('removes cached values', () => {
      store(instance, 'key', 'group', 'value');
      instance.clearCache();
      const result = find(instance, 'key', 'group');
      assert.equal(result, null);
    });
  });

  describe('_setupJexl()', () => {
    let instance;
    beforeEach(async () => {
      instance = new VariablesClass({
        jexlPath: 'ArcVariables.JexlDev',
      });
    });

    afterEach(() => {
      // @ts-ignore
      delete window.varTestObj;
    });

    it('returns undefined when no jexlPath', () => {
      instance.jexlPath = undefined;
      const result = instance._setupJexl();
      assert.equal(result, null);
    });

    it('returns reference to a window object: no parts in path', () => {
      // @ts-ignore
      window.varTestObj = {};
      instance.jexlPath = 'varTestObj';
      const result = instance._setupJexl();
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
      instance.jexlPath = 'varTestObj.path.to.jexl';
      const result = instance._setupJexl();
      // @ts-ignore
      assert.isTrue(result === window.varTestObj.path.to.jexl);
    });

    it('returns undefined when the path is incorrect', () => {
      // @ts-ignore
      window.varTestObj = {
        path: {},
      };
      instance.jexlPath = 'varTestObj.path.to.jexl';
      const result = instance._setupJexl();
      assert.equal(result, null);
    });
  });

  describe('_callFn()', () => {
    let instance;
    beforeEach(async () => {
      instance = new VariablesClass({
        jexlPath: 'ArcVariables.JexlDev',
      });
    });

    it('Throws when function do not exists', () => {
      assert.throws(() => {
        instance._callFn('nonExisting');
      });
    });

    it('Throws when namespace function do not exists', () => {
      assert.throws(() => {
        instance._callFn('Something.nonExisting');
      });
    });

    it('Calls now() function', () => {
      const spy = sinon.spy(instance, '__evalFnNow');
      instance._callFn('now');
      assert.isTrue(spy.called);
    });

    it('Calls random() function', () => {
      const spy = sinon.spy(instance, '__evalFnRandom');
      instance._callFn('random');
      assert.isTrue(spy.called);
    });

    it('Calls EvalFunctions.EncodeURIComponent() function', () => {
      const spy = sinon.spy(EvalFunctions, 'EncodeURIComponent');
      instance._callFn('encodeURIComponent', ['a']);
      assert.isTrue(spy.called);
      spy.restore();
    });

    it('Calls EvalFunctions.DecodeURIComponent() function', () => {
      const spy = sinon.spy(EvalFunctions, 'DecodeURIComponent');
      instance._callFn('decodeURIComponent', ['a']);
      assert.isTrue(spy.called);
      spy.restore();
    });

    it('Calls Math.xxx() function', () => {
      const spy = sinon.spy(instance, '_callNamespaceFunction');
      instance._callFn('Math.abs', [1]);
      assert.isTrue(spy.called);
      assert.equal(spy.args[0][0], 'Math', 'namespace is set');
      assert.equal(spy.args[0][1], 'abs', 'function name is set');
      assert.deepEqual(spy.args[0][2], [1], 'arguments is set');
    });

    it('Calls String.xxx() function', () => {
      const spy = sinon.spy(instance, '_callNamespaceFunction');
      instance._callFn('String.substr', ['test', 1]);
      assert.isTrue(spy.called);
      assert.equal(spy.args[0][0], 'String', 'namespace is set');
      assert.equal(spy.args[0][1], 'substr', 'function name is set');
      assert.typeOf(spy.args[0][2], 'array', 'arguments is set');
    });

    it('Calls JSON.xxx() function', () => {
      const spy = sinon.spy(instance, '_callNamespaceFunction');
      instance._callFn('JSON.parse', ['{}']);
      assert.isTrue(spy.called);
      assert.equal(spy.args[0][0], 'JSON', 'namespace is set');
      assert.equal(spy.args[0][1], 'parse', 'function name is set');
      assert.deepEqual(spy.args[0][2], ['{}'], 'arguments is set');
    });
  });

  describe('buildContext()', () => {
    let instance;

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
      instance = new VariablesClass({
        jexlPath: 'ArcVariables.JexlDev',
      });
    });

    it('Should create a context', () => {
      return instance.buildContext();
    });

    it('Returns empty object when has no variables', async () => {
      window.addEventListener('environment-current', function f(e) {
        window.removeEventListener('environment-current', f);
        e.stopPropagation();
        e.preventDefault();
        // @ts-ignore
        e.detail.variables = [];
      });
      const result = await instance.buildContext();
      assert.typeOf(result, 'object');
      assert.lengthOf(Object.keys(result), 0);
    });

    it('Sets variable value', async () => {
      const context = await instance.buildContext();
      assert.equal(context.test2, 'value2 value1');
    });

    it('Sets variable value defined later', async () => {
      const context = await instance.buildContext();
      assert.equal(context.test3, 'value3 value4');
    });

    it('Do not uses disabled elements', async () => {
      const context = await instance.buildContext();
      assert.isUndefined(context.test5);
    });

    it('Override context values', async () => {
      const opts = {
        test1: 'ov1',
        test2: 'ov2',
      };
      const context = await instance.buildContext(opts);
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
      const context = await instance.buildContext(opts);
      assert.equal(context.test1, 'ov1');
      assert.equal(context.test2, 'ov2');
      assert.equal(context.newVar, 'new');
    });
  });
});
