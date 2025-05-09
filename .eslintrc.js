module.exports = {
  root: true,
  env: {
    node: true,
    commonjs: true,
    es6: true,
    jest: true
  },
  extends: [
    'standard',
    'plugin:jest/recommended',
    'plugin:node/recommended',
    'prettier'
  ],
  plugins: [
    'jest',
    'node',
    'promise'
  ],
  parserOptions: {
    ecmaVersion: 2022
  },
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'jest/expect-expect': 'warn',
    'node/no-unpublished-require': ['error', {
      'allowModules': ['supertest', 'jest-image-snapshot']
    }]
  },
  ignorePatterns: [
    'node_modules/',
    'coverage/'
  ]
}