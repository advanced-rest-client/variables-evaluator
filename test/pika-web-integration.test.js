import { fixture, assert } from '@open-wc/testing';
import { Jexl } from '../web_modules/jexl/lib/Jexl.js';
import '../variables-evaluator.js';

/* eslint-disable no-template-curly-in-string */

// @ts-ignore
window.Jexl = Jexl;

describe('@pika/web integration', () => {
  async function basicFixture() {
    return fixture(
      `<variables-evaluator jexlpath="ArcVariables.JexlDev"></variables-evaluator>`
    );
  }

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

    it('Evaluates variable', async () => {
      const result = await element.evaluateVariable('test ${test1}');
      assert.equal(result, 'test value1');
    });
  });
});
