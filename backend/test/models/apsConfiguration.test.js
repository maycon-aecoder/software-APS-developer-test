const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ApsConfiguration,
  APS_CONFIGURATION_PROJECTIONS,
} = require('../../src/models/ApsConfiguration');

test('defines one unique per-user configuration index', () => {
  const uniqueUserIndexes = ApsConfiguration.schema
    .indexes()
    .filter(([fields, options]) => fields.userId === 1 && options.unique === true);

  assert.equal(uniqueUserIndexes.length, 1);
  assert.equal(
    ApsConfiguration.schema.options.autoIndex,
    true,
    'The explicit startup init must not inherit a disabled global autoIndex setting',
  );
});

test('excludes the secret envelope by default and exposes explicit safe and service projections', () => {
  assert.equal(ApsConfiguration.schema.path('secretEnvelope')?.options.select, false);
  assert.equal(APS_CONFIGURATION_PROJECTIONS.safe.secretEnvelope, undefined);
  assert.equal(APS_CONFIGURATION_PROJECTIONS.safe.userId, undefined);
  assert.equal(APS_CONFIGURATION_PROJECTIONS.safe.createdAt, undefined);
  assert.equal(APS_CONFIGURATION_PROJECTIONS.safe.updatedAt, undefined);
  assert.equal(APS_CONFIGURATION_PROJECTIONS.safe.clientId, 1);
  assert.equal(APS_CONFIGURATION_PROJECTIONS.safe.modelUrn, 1);
  assert.equal(APS_CONFIGURATION_PROJECTIONS.service.secretEnvelope, 1);
});

test('removes the secret envelope from JSON serialization as a defense in depth', () => {
  const configuration = new ApsConfiguration({
    userId: '66b28e44b8967d23c43e9371',
    clientId: 'synthetic-client-id',
    modelUrn: 'dGVzdC1tb2RlbA',
    secretEnvelope: {
      version: 1,
      ciphertext: 'c3ludGhldGlj',
      iv: 'MTIzNDU2Nzg5MDEy',
      authTag: 'MTIzNDU2Nzg5MDEyMzQ1Ng==',
    },
  });

  assert.equal(configuration.toJSON().secretEnvelope, undefined);
});
