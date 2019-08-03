/* eslint-disable import/no-extraneous-dependencies */
const { createDefaultConfig } = require('@open-wc/testing-karma');
const merge = require('deepmerge');

module.exports = (config) => {
  config.set(
    merge(createDefaultConfig(config), {
      files: [
        // runs all files ending with .test in the test folder,
        // can be overwritten by passing a --grep flag. examples:
        //
        // npm run test -- --grep test/foo/bar.test.js
        // npm run test -- --grep test/bar/*
        {
          pattern: config.grep ? config.grep : 'test/**/*.test.js',
          type: 'module'
        },
        {
          pattern: 'dev-lib/jexl.min.js',
          type: 'js'
        }
      ],

      // see the karma-esm docs for all options
      esm: {
        // if you are using 'bare module imports' you will need this option
        nodeResolve: true
      },

      /**
       * dev-lib contains a build of Jexl which is 3rd party library
       * and it is not tested here.
       * It is included imto coverage report though. This configuration
       * lowers general test pass limit but keeps regular limits for each file.
       */
      coverageIstanbulReporter: {
        thresholds: {
          global: {
            statements: 70,
            branches: 60,
            functions: 50,
            lines: 80
          },
          each: {
            statements: 80,
            lines: 80,
            branches: 80,
            functions: 90,
            overrides: {
              'dev-lib/**/*.js': {
                statements: 0,
                lines: 0,
                branches: 0,
                functions: 0
              }
            }
          }
        }
      },
    })
  );
  return config;
};
