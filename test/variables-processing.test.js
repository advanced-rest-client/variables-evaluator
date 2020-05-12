import { assert } from '@open-wc/testing';
import { VariablesMixin } from '../index.js';
import { clear } from '../src/Cache.js';
import { observeVariables, unobserveVariables } from './Utils.js';

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
  const variables = [
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
      value: 'value3 {test4}',
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
    {
      variable: 'host',
      value: 'api',
      enabled: true,
    },
    {
      variable: 'path',
      value: 'path',
      enabled: true,
    },
  ];

  before(() => {
    observeVariables(variables);
  });

  after(() => {
    unobserveVariables();
  });

  describe('Variabvles processing', () => {
    let instance;
    before(() => {
      instance = new VariablesClass({
        jexlPath: 'ArcVariables.JexlDev',
      });
    });

    afterEach(() => {
      clear(instance);
    });

    [
      ['Test 1: ${test1}', 'Test 1: value1'],
      ['Test 2: {test1}', 'Test 2: value1'],
      ['Test 3: ${test2}', 'Test 3: value2 value1'],
      ['Test 4: {test2}', 'Test 4: value2 value1'],
      ['Test 5: ${test3}', 'Test 5: value3 value4'],
      ['Test 6: {test3}', 'Test 6: value3 value4'],
      ['Test 7: ${test5}', 'Test 7: undefined'],
      ['Test 8: {test5}', 'Test 8: undefined'],
      ['${String.toLowerCase(TEST)}', 'test'],
      ['{String.toLowerCase(TEST)}', 'test'],
      ['${Math.abs(-110)}', '110'],
      ['{Math.abs(-110)}', '110'],
      ['${encodeURIComponent(te s+t)}', 'te%20s%2Bt'],
      ['{encodeURIComponent(te s+t)}', 'te%20s%2Bt'],
      ['${decodeURIComponent(te%20s%2Bt)}', 'te s+t'],
      ['{decodeURIComponent(te%20s%2Bt)}', 'te s+t'],
      [
        '{\n\t"v1":"${test1}",\n\t"v2": "${test2}"\n}',
        '{\n\t"v1":"value1",\n\t"v2": "value2 value1"\n}',
      ],
      [
        '{"v1":"${test1}","v2": "${test2}"}',
        '{"v1":"value1","v2": "value2 value1"}',
      ],
      [
        '{\n\t"v1":"{test1}",\n\t"v2": "{test2}"\n}',
        '{\n\t"v1":"value1",\n\t"v2": "value2 value1"\n}',
      ],
      [
        '{"v1":"{test1}","v2": "{test2}"}',
        '{"v1":"value1","v2": "value2 value1"}',
      ],
      ['https://{host}.domain.com', 'https://api.domain.com'],
      ['https://api.domain.com/a/{path}/b', 'https://api.domain.com/a/path/b'],
    ].forEach(([src, value]) => {
      it(`${src}`, async () => {
        const result = await instance.evaluateVariable(src);
        assert.equal(result, value);
      });
    });

    [
      ['JS syntax: ${now}', /JS syntax: \d+/],
      ['API syntax: {now}', /API syntax: \d+/],
      ['JS syntax: ${random()}', /JS syntax: \d+/],
      ['API syntax: {random()}', /API syntax: \d+/],
    ].forEach(([src, value]) => {
      it(`${src}`, async () => {
        const result = await instance.evaluateVariable(src);
        assert.match(result, /** @type RegExp */ (value));
      });
    });
  });
});
