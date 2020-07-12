module.exports = {
  preset: 'jest-puppeteer',
  globals: {
    URL: 'http://localhost:3000',
  },
  testMatch: ['**/specs/*.js'],
  transform: {
    '\\.js$': 'react-scripts/config/jest/babelTransform',
  },
  verbose: true,
};
