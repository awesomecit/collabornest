// @ts-check
// eslint.config.mjs - Configurazione bilanciata (meno warning, focus su cognitive complexity)

import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Files to ignore
  {
    ignores: [
      'eslint.config.mjs',
      'commitlint.config.js',
      'scripts/**/*.js',
      'dist/**/*',
      'node_modules/**/*',
      'coverage/**/*',
      'reports/**/*',
      'reference/**/*',
      '*.config.js',
      '**/*.spec.ts',
      '**/*.test.ts',
      'test/setup.ts',
      'test/globalSetup.js',
      'test/globalTeardown.js',
      'test/helpers/**/*',
      'jest.integration.config.js',
      'jest.unit.config.js',
      'jest-e2e.config.js',
      'test/jest-integration.json',
      'test/jest-unit.json',
      'test/jest-e2e.json',
      'test/**/*.ts',
      'test/**/*.js',
      'docs/learning/labs/**/*.js',
      'docs/learning/labs/**/*.ts',
    ],
  },

  // Base configurations
  ...tseslint.configs.recommended,

  // SonarJS configuration - Focus su cognitive complexity
  {
    plugins: {
      sonarjs,
    },
    rules: {
      // 🧠 COGNITIVE COMPLEXITY - Clean Code Focus!
      'sonarjs/cognitive-complexity': ['error', 10], // Ridotto da 15 a 10 per promuovere clean code

      // 🔄 COMPLEXITY - Soglie restrittive per clean code
      'complexity': ['error', { max: 10 }], // Ridotto da 15 a 10
      'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }], // Ridotto da 80 a 50
      'max-params': ['error', { max: 4 }], // Ridotto da 6 a 4 (SOLID principles)
      'max-depth': ['error', { max: 3 }], // Ridotto da 5 a 3 (avoid deep nesting)
      'max-nested-callbacks': ['error', { max: 3 }], // Ridotto da 4 a 3
      'max-statements': ['error', { max: 20 }], // Nuova regola: max 20 statements per function
      'max-statements-per-line': ['error', { max: 1 }], // Una statement per riga

      // 🎯 SONARJS - Clean Code Rules
      'sonarjs/no-duplicate-string': ['error', { threshold: 3 }], // No stringhe duplicate
      'sonarjs/no-identical-functions': 'error', // No funzioni identiche (DRY principle)
      'sonarjs/prefer-immediate-return': 'error', // Return immediato quando possibile
      'sonarjs/prefer-single-boolean-return': 'error', // Single boolean return
      'sonarjs/no-small-switch': 'error', // No switch piccoli (usa if-else)
      'sonarjs/no-nested-template-literals': 'error', // No template literals nidificati
      'sonarjs/no-redundant-jump': 'error', // No jump ridondanti
      'sonarjs/no-same-line-conditional': 'error', // No condizionali sulla stessa riga
      'sonarjs/no-useless-catch': 'error', // No catch inutili

      // 🔐 SINGLE SOURCE OF TRUTH - WebSocket Events & Error Codes
      // Enforce usage of enums for WebSocket events and error codes
      // Magic strings allowed only in enum definitions and test files
      'no-magic-numbers': 'off', // Numbers are OK (ports, timeouts, etc.)
      // Note: no-magic-strings requires manual code review or custom plugin
      // Developers must use WsEvent, WsErrorCode, WsErrorMessage enums

      // 🎯 TYPESCRIPT (più permissivo per NestJS)
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      '@typescript-eslint/prefer-optional-chain': 'off', // Disabilitato per non essere troppo noisy
      '@typescript-eslint/prefer-nullish-coalescing': 'off', // Disabilitato per non essere troppo noisy

      // 🏗️ CODE QUALITY (solo essenziali)
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': 'off', // Permesso in NestJS per logging
      'no-debugger': 'error',
      'object-shorthand': 'off', // Disabilitato per non essere troppo noisy
      'prefer-arrow-callback': 'off', // Disabilitato per non essere troppo noisy

      // 🚫 DISABLE per NestJS
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
    },
  },

  // Language options
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Prettier (ultimo per evitare conflitti)
  eslintPluginPrettierRecommended,
);
