const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createApiResponseDouble,
  createApsConfigurationFixture,
  createApsTokenFixture,
  createEncryptionKeyFixture,
} = require('./fixtures/apsFixtures');

test('backend test tooling imports safe APS fixtures', () => {
  const response = createApiResponseDouble();

  response.status(200).json(createApsConfigurationFixture());

  assert.equal(Buffer.from(createEncryptionKeyFixture(), 'base64').length, 32);
  assert.equal(createApsTokenFixture().expires_in, 3599);
  assert.deepEqual(response.calls.map(([method]) => method), ['status', 'json']);
});
