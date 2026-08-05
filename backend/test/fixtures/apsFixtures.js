const { Buffer } = require('node:buffer');

function createEncryptionKeyFixture(fill = 7) {
  return Buffer.alloc(32, fill).toString('base64');
}

function createApsConfigurationFixture(overrides = {}) {
  return {
    clientId: 'test-client-id',
    modelUrn: 'dGVzdC1tb2RlbA',
    ...overrides,
  };
}

function createApsTokenFixture(overrides = {}) {
  return {
    access_token: 'test-access-token',
    expires_in: 3599,
    token_type: 'Bearer',
    ...overrides,
  };
}

function createApiResponseDouble() {
  const calls = [];

  return {
    calls,
    status(code) {
      calls.push(['status', code]);
      return this;
    },
    json(body) {
      calls.push(['json', body]);
      return this;
    },
  };
}

module.exports = {
  createApiResponseDouble,
  createApsConfigurationFixture,
  createApsTokenFixture,
  createEncryptionKeyFixture,
};
