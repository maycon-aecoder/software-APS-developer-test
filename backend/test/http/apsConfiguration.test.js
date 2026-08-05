const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const { createApsRouter } = require('../../src/routes/aps');

const productionApp = require('../../src/app');

const jwtSecret = 'synthetic-jwt-secret-for-http-tests';
const userId = '66b28e44b8967d23c43e9371';
const otherUserId = '66b28e44b8967d23c43e9372';
let previousJwtSecret;

test.before(() => {
  previousJwtSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = jwtSecret;
});

test.after(() => {
  if (previousJwtSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = previousJwtSecret;
  }
});

function createToken(id) {
  return jwt.sign({ id, email: 'user@example.test', name: 'Test User' }, jwtSecret);
}

function createServiceDouble({ getResult = null, saveResult } = {}) {
  const calls = [];
  let getError = null;
  let saveError = null;

  return {
    calls,
    service: {
      async getConfiguration(authenticatedUserId) {
        calls.push(['getConfiguration', authenticatedUserId]);
        if (getError) throw getError;
        return getResult;
      },
      async saveConfiguration(authenticatedUserId, input) {
        calls.push(['saveConfiguration', authenticatedUserId, input]);
        if (saveError) throw saveError;
        return saveResult;
      },
    },
    rejectGet(error) {
      getError = error;
    },
    rejectSave(error) {
      saveError = error;
    },
  };
}

function createLoggerDouble() {
  const entries = [];
  return {
    entries,
    logger: {
      error(message, metadata) {
        entries.push({ message, metadata });
      },
    },
  };
}

function createTestApp(service, logger = { error() {} }) {
  const app = express();
  app.use(express.json());
  app.use('/api/aps', createApsRouter({ configurationService: service, logger }));
  return app;
}

function featureError(code, message = 'Synthetic safe service failure') {
  return Object.assign(new Error(message), { code });
}

test('mounts the APS configuration route behind existing authentication in the production app', async () => {
  const response = await request(productionApp).get('/api/aps/configuration');

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, {
    message: 'No token provided, authorization denied',
  });
});

test('rejects an invalid token before calling the configuration service', async () => {
  const controlled = createServiceDouble();
  const app = createTestApp(controlled.service);

  const response = await request(app)
    .get('/api/aps/configuration')
    .set('Authorization', 'Bearer invalid-token');

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { message: 'Token is not valid' });
  assert.equal(controlled.calls.length, 0);
});

test('returns an explicit no-record configuration state', async () => {
  const controlled = createServiceDouble({ getResult: null });
  const app = createTestApp(controlled.service);

  const response = await request(app)
    .get('/api/aps/configuration')
    .set('Authorization', `Bearer ${createToken(userId)}`);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { configured: false, configuration: null });
  assert.deepEqual(controlled.calls, [['getConfiguration', userId]]);
});

test('returns only the current user safe configuration and configured-secret indicator', async () => {
  const controlled = createServiceDouble({
    getResult: {
      clientId: 'synthetic-client-id',
      modelUrn: 'dGVzdC1tb2RlbA',
      userId: otherUserId,
      clientSecret: 'must-not-be-returned',
      secretEnvelope: { ciphertext: 'must-not-be-returned' },
      createdAt: '2026-08-05T00:00:00.000Z',
    },
  });
  const app = createTestApp(controlled.service);

  const response = await request(app)
    .get('/api/aps/configuration')
    .set('Authorization', `Bearer ${createToken(userId)}`);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    configured: true,
    configuration: {
      clientId: 'synthetic-client-id',
      modelUrn: 'dGVzdC1tb2RlbA',
      hasClientSecret: true,
    },
  });
  assert.deepEqual(controlled.calls, [['getConfiguration', userId]]);
});

test('keeps two authenticated users isolated through server-derived identities', async () => {
  const controlled = createServiceDouble({
    getResult: { clientId: 'synthetic-client-id', modelUrn: 'dGVzdC1tb2RlbA' },
  });
  const app = createTestApp(controlled.service);

  await request(app)
    .get('/api/aps/configuration')
    .set('Authorization', `Bearer ${createToken(userId)}`)
    .expect(200);
  await request(app)
    .get('/api/aps/configuration')
    .set('Authorization', `Bearer ${createToken(otherUserId)}`)
    .expect(200);

  assert.deepEqual(controlled.calls, [
    ['getConfiguration', userId],
    ['getConfiguration', otherUserId],
  ]);
});

test('does not misrepresent a configuration read failure as first-time state', async () => {
  const controlled = createServiceDouble();
  controlled.rejectGet(featureError(
    'APS_CONFIGURATION_READ_FAILED',
    'Synthetic cause containing synthetic-client-secret',
  ));
  const logging = createLoggerDouble();
  const app = createTestApp(controlled.service, logging.logger);

  const response = await request(app)
    .get('/api/aps/configuration')
    .set('Authorization', `Bearer ${createToken(userId)}`);

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    code: 'APS_CONFIGURATION_READ_FAILED',
    message: 'Saved APS settings could not be loaded. Try again.',
    fieldErrors: {},
  });
  assert.equal(response.body.configured, undefined);
  assert.equal(JSON.stringify(logging.entries).includes('synthetic-client-secret'), false);
  assert.equal(logging.entries.length, 1);
  assert.equal(logging.entries[0].metadata.operation, 'read-configuration');
  assert.equal(logging.entries[0].metadata.code, 'APS_CONFIGURATION_READ_FAILED');
});

const successfulSaveCases = [
  ['credential replacement', 'credential-replacement', 'synthetic-client-secret'],
  ['URN-only update', 'urn-only', ''],
];

for (const [label, changeType, clientSecret] of successfulSaveCases) {
  test(`returns a safe authoritative response for ${label}`, async () => {
    const controlled = createServiceDouble({
      saveResult: {
        configuration: {
          clientId: 'synthetic-client-id',
          modelUrn: 'dGVzdC1tb2RlbA',
          clientSecret: 'must-not-be-returned',
          secretEnvelope: { ciphertext: 'must-not-be-returned' },
        },
        changeType,
      },
    });
    const app = createTestApp(controlled.service);

    const response = await request(app)
      .put('/api/aps/configuration')
      .set('Authorization', `Bearer ${createToken(userId)}`)
      .send({
        userId: otherUserId,
        clientId: 'synthetic-client-id',
        clientSecret,
        modelUrn: 'dGVzdC1tb2RlbA',
        unexpected: 'must-not-reach-service',
      });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      configured: true,
      configuration: {
        clientId: 'synthetic-client-id',
        modelUrn: 'dGVzdC1tb2RlbA',
        hasClientSecret: true,
      },
      changeType,
    });
    assert.deepEqual(controlled.calls, [[
      'saveConfiguration',
      userId,
      {
        clientId: 'synthetic-client-id',
        clientSecret,
        modelUrn: 'dGVzdC1tb2RlbA',
      },
    ]]);
  });
}

const validationCases = [
  [
    'APS_CLIENT_ID_REQUIRED',
    'Check the APS Client ID and try again.',
    { clientId: 'Enter your APS Client ID.' },
  ],
  [
    'APS_CLIENT_SECRET_REQUIRED',
    'Check the APS Client Secret and try again.',
    {
      clientSecret: 'Enter the APS Client Secret when setting up APS or changing the Client ID.',
    },
  ],
  [
    'APS_CLIENT_SECRET_INVALID',
    'Check the APS Client Secret and try again.',
    {
      clientSecret: 'Enter the APS Client Secret as text, or leave it blank to keep the saved secret.',
    },
  ],
  [
    'INVALID_MODEL_URN',
    'Check the Model URN and try again.',
    {
      modelUrn: 'Enter an unpadded Base64URL source-design URN with no prefix or one lowercase "urn:" prefix.',
    },
  ],
];

for (const [code, message, fieldErrors] of validationCases) {
  test(`maps ${code} to an actionable field error`, async () => {
    const controlled = createServiceDouble();
    controlled.rejectSave(featureError(code));
    const app = createTestApp(controlled.service);

    const response = await request(app)
      .put('/api/aps/configuration')
      .set('Authorization', `Bearer ${createToken(userId)}`)
      .send({ clientId: '', clientSecret: '', modelUrn: '' });

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, { code, message, fieldErrors });
    assert.equal(response.body.configured, undefined);
  });
}

const operationalFailureCases = [
  [
    'APS_CONFIGURATION_CONFLICT',
    409,
    'APS settings changed during this save. Reload them and try again.',
  ],
  [
    'APS_CONFIG_ENCRYPTION_KEY_INVALID',
    503,
    'APS settings cannot be saved right now. Contact the application administrator and try again.',
  ],
  [
    'APS_CLIENT_SECRET_ENCRYPTION_FAILED',
    500,
    'APS settings could not be secured and were not saved. Try again.',
  ],
  [
    'APS_CONFIGURATION_SAVE_FAILED',
    500,
    'APS settings were not saved. Try again.',
  ],
];

for (const [code, status, message] of operationalFailureCases) {
  test(`maps ${code} without returning a false save success or sensitive diagnostics`, async () => {
    const controlled = createServiceDouble();
    controlled.rejectSave(featureError(
      code,
      'Synthetic raw cause containing synthetic-client-secret and ciphertext',
    ));
    const logging = createLoggerDouble();
    const app = createTestApp(controlled.service, logging.logger);

    const response = await request(app)
      .put('/api/aps/configuration')
      .set('Authorization', `Bearer ${createToken(userId)}`)
      .send({
        clientId: 'synthetic-client-id',
        clientSecret: 'synthetic-client-secret',
        modelUrn: 'dGVzdC1tb2RlbA',
      });

    assert.equal(response.status, status);
    assert.deepEqual(response.body, { code, message, fieldErrors: {} });
    assert.equal(response.body.configured, undefined);
    assert.equal(response.body.changeType, undefined);
    const serializedLogs = JSON.stringify(logging.entries);
    assert.equal(serializedLogs.includes('synthetic-client-secret'), false);
    assert.equal(serializedLogs.includes('ciphertext'), false);
    assert.equal(logging.entries.length, 1);
    assert.equal(logging.entries[0].metadata.operation, 'save-configuration');
    assert.equal(logging.entries[0].metadata.code, code);
  });
}

test('maps an unclassified failure to a safe actionable internal error', async () => {
  const controlled = createServiceDouble();
  const unknownError = new Error(
    'Synthetic unknown cause containing synthetic-client-secret and ciphertext',
  );
  unknownError.code = 'toString';
  controlled.rejectSave(unknownError);
  const logging = createLoggerDouble();
  const app = createTestApp(controlled.service, logging.logger);

  const response = await request(app)
    .put('/api/aps/configuration')
    .set('Authorization', `Bearer ${createToken(userId)}`)
    .send({
      clientId: 'synthetic-client-id',
      clientSecret: 'synthetic-client-secret',
      modelUrn: 'dGVzdC1tb2RlbA',
    });

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    code: 'APS_CONFIGURATION_INTERNAL_ERROR',
    message: 'APS settings could not be saved because of an unexpected error. Try again.',
    fieldErrors: {},
  });
  assert.equal(JSON.stringify(logging.entries).includes('synthetic-client-secret'), false);
  assert.equal(JSON.stringify(logging.entries).includes('ciphertext'), false);
  assert.equal(logging.entries[0].metadata.operation, 'save-configuration');
  assert.equal(logging.entries[0].metadata.code, 'APS_CONFIGURATION_INTERNAL_ERROR');
});
