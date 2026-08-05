const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const { createApsRouter } = require('../../src/routes/aps');

const jwtSecret = 'synthetic-jwt-secret-for-token-http-tests';
const userId = '66b28e44b8967d23c43e9371';
let previousJwtSecret;

test.before(() => {
  previousJwtSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = jwtSecret;
});

test.after(() => {
  if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousJwtSecret;
});

function createToken() {
  return jwt.sign({ id: userId, email: 'user@example.test' }, jwtSecret);
}

function createControlledRouter() {
  const calls = [];
  let tokenError = null;
  let tokenResult = { accessToken: 'synthetic-access-token', expiresIn: 3599 };
  const configurationService = {
    async getConfiguration() {
      return null;
    },
    async saveConfiguration() {
      return undefined;
    },
  };
  const tokenService = {
    async getViewerToken(authenticatedUserId) {
      calls.push(['getViewerToken', authenticatedUserId]);
      if (tokenError) throw tokenError;
      return tokenResult;
    },
  };
  const logs = [];
  const router = createApsRouter({
    configurationService,
    tokenService,
    logger: {
      error(message, metadata) {
        logs.push({ message, metadata });
      },
    },
  });
  const app = express();
  app.use(express.json());
  app.use('/api/aps', router);

  return {
    app,
    calls,
    logs,
    reject(error) {
      tokenError = error;
    },
    resolve(result) {
      tokenResult = result;
    },
  };
}

function featureError(code, message = 'Synthetic safe token failure') {
  return Object.assign(new Error(message), { code });
}

test('protects the token endpoint with existing authentication', async () => {
  const controlled = createControlledRouter();

  const response = await request(controlled.app).post('/api/aps/token');

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, {
    message: 'No token provided, authorization denied',
  });
  assert.equal(controlled.calls.length, 0);
});

test('returns only a short-lived token and lifetime for the authenticated user', async () => {
  const controlled = createControlledRouter();

  const response = await request(controlled.app)
    .post('/api/aps/token')
    .set('Authorization', `Bearer ${createToken()}`)
    .send({
      clientId: 'browser-client-id-must-be-ignored',
      clientSecret: 'browser-secret-must-be-ignored',
      scope: 'data:write',
      modelUrn: 'browser-urn-must-be-ignored',
    });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    accessToken: 'synthetic-access-token',
    expiresIn: 3599,
  });
  assert.deepEqual(controlled.calls, [['getViewerToken', userId]]);
});

const failureCases = [
  [
    'APS_CONFIGURATION_REQUIRED',
    409,
    'Save your APS settings before loading a model.',
  ],
  [
    'APS_CREDENTIALS_REJECTED',
    422,
    'APS could not authorize the saved credentials. Verify the Client ID and Client Secret.',
  ],
  [
    'APS_TOKEN_INVALID_RESPONSE',
    502,
    'APS returned an invalid access response. Try again.',
  ],
  [
    'APS_TOKEN_TEMPORARY_FAILURE',
    503,
    'APS access is temporarily unavailable. Check your connection and try again.',
  ],
  [
    'APS_CONFIG_ENCRYPTION_KEY_INVALID',
    503,
    'APS access cannot be requested right now. Contact the application administrator and try again.',
  ],
  [
    'APS_CLIENT_SECRET_DECRYPTION_FAILED',
    500,
    'Saved APS credentials could not be read securely. Re-enter them and try again.',
  ],
  [
    'APS_CONFIGURATION_READ_FAILED',
    500,
    'Saved APS settings could not be loaded. Try again.',
  ],
];

for (const [code, status, message] of failureCases) {
  test(`maps ${code} to a safe token response and diagnostic`, async () => {
    const controlled = createControlledRouter();
    controlled.reject(featureError(
      code,
      'Synthetic raw cause with synthetic-access-token, synthetic-client-secret, and ciphertext',
    ));

    const response = await request(controlled.app)
      .post('/api/aps/token')
      .set('Authorization', `Bearer ${createToken()}`);

    assert.equal(response.status, status);
    assert.deepEqual(response.body, { code, message, fieldErrors: {} });
    const serializedLogs = JSON.stringify(controlled.logs);
    assert.equal(serializedLogs.includes('synthetic-access-token'), false);
    assert.equal(serializedLogs.includes('synthetic-client-secret'), false);
    assert.equal(serializedLogs.includes('ciphertext'), false);
    assert.equal(controlled.logs[0].metadata.operation, 'request-viewer-token');
    assert.equal(controlled.logs[0].metadata.code, code);
  });
}

test('maps an unknown token failure to a terminating safe fallback', async () => {
  const controlled = createControlledRouter();
  const error = new Error('Synthetic unknown failure with synthetic-access-token');
  error.code = 'toString';
  controlled.reject(error);

  const response = await request(controlled.app)
    .post('/api/aps/token')
    .set('Authorization', `Bearer ${createToken()}`);

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    code: 'APS_TOKEN_INTERNAL_ERROR',
    message: 'APS access could not be requested because of an unexpected error. Try again.',
    fieldErrors: {},
  });
  assert.equal(JSON.stringify(controlled.logs).includes('synthetic-access-token'), false);
});
