import { fixture, assert } from '@open-wc/testing';
import { Jexl } from '../web_modules/jexl/lib/Jexl.js';
window.Jexl = Jexl;
import '../variables-evaluator.js';

describe('@pika/web integration', function() {
  async function basicFixture() {
    return await fixture(`<variables-evaluator jexlpath="ArcVariables.JexlDev"></variables-evaluator>`);
  }

  describe('evaluateVariable()', function() {
    let element;
    const contextFactory = function(e) {
      e.preventDefault();
      e.detail.variables = [{
        variable: 'test1',
        value: 'value1',
        enabled: true
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

    it('Evaluates variable', function() {
      return element.evaluateVariable('test ${test1}')
      .then(function(result) {
        assert.equal(result, 'test value1');
      });
    });
  });
});
