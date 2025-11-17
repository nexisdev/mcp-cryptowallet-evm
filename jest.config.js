/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^fastmcp$': '<rootDir>/tests/mocks/fastmcp.ts',
    '^@scure/bip39/wordlists/(.*)\\.js$': '<rootDir>/tests/mocks/bip39-wordlists/$1.ts',
    '^@scure/bip39/wordlists/(.*)$': '<rootDir>/tests/mocks/bip39-wordlists/$1.ts',
    '^ethers$': '<rootDir>/tests/mocks/ethers.ts',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: './tsconfig.test.json',
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(fastmcp|@modelcontextprotocol)/)',
  ],
};
