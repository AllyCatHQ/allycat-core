import n from 'eslint-plugin-n';

export default [
  {
    ignores: ['node_modules/**', 'tests/fixtures/**', 'tests/samples/**'],
  },
  n.configs['flat/recommended'],
  {
    rules: {
      'n/no-missing-import': 'error',
      'n/no-unsupported-features/es-syntax': 'off',
      // CLI tool — process.exit() is intentional for exit code enforcement
      'n/no-process-exit': 'off',
      // playwright is an optional install — dynamic import is inside try/catch intentionally
      'n/no-unpublished-import': 'off',
    },
  },
];
