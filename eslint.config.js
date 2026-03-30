// ESLint 9 flat config — used when running with global ESLint (no node_modules).
// When node_modules are installed (npm install), the .eslintrc.js airbnb-base
// config will be preferred instead via the ESLINT_USE_FLAT_CONFIG=false flag.

// Stub for eslint-plugin-import — referenced in legacy eslint-disable comments
// but not available without npm install. Prevents "rule not found" errors.
const importPlugin = {
  meta: { name: 'import' },
  rules: {
    'prefer-default-export': { create: () => ({}) },
    'no-cycle': { create: () => ({}) },
    extensions: { create: () => ({}) },
  },
};

export default [
  {
    ignores: [
      'node_modules/**',
      'scripts/aem.js', // EDS boilerplate — not our code
    ],
  },
  {
    plugins: { import: importPlugin },
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        CustomEvent: 'readonly',
        HTMLElement: 'readonly',
        CSS: 'readonly',
        Promise: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        history: 'readonly',
        location: 'readonly',
        CompressionStream: 'readonly',
        DecompressionStream: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        MutationObserver: 'readonly',
        IntersectionObserver: 'readonly',
        ResizeObserver: 'readonly',
      },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'prefer-const': 'warn',
      'no-var': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      curly: ['warn', 'multi-line'],
    },
  },
];
