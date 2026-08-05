const assert = require('node:assert/strict');
const test = require('node:test');

const { createApsTokenService } = require('../../src/services/apsTokenService');

const userId = '66b28e44b8967d23c43e9371';
const clientId = 'synthetic-client-id';
const clientSecret = 'synthetic-client-secret';
const secretEnvelope = {
  version: 1,
  ciphertext: 'synthetic-ciphertext',
  iv: 'synthetic-iv',
  authTag: 'synthetic-auth-tag',
};

function createResponse({
  jsonError,
  jsonResult = {
    access_token: 'synthetic-access-token',
    expires_in: 3599,
    token_type: 'Bearer',
  },
  ok = true,
  status = 200,
} = {}) {
  return {
    ok,
    status,
    async json() {
      if (jsonError) throw jsonError;
      return jsonResult;
    },
  };
}

function createService({ configuration = undefined, decryptError, fetchImpl } = {}) {
  const calls = [];
  const storedConfiguration = configuration === undefined
    ? { clientId, modelUrn: 'dGVzdC1tb2RlbA', secretEnvelope }
    : configuration;
  const configurationService = {
    async getConfigurationForService(authenticatedUserId) {
      calls.push(['getConfigurationForService', authenticatedUserId]);
      return storedConfiguration;
    },
  };
  const encryption = {
    decryptClientSecret(input) {
      calls.push(['decryptClientSecret', input]);
      if (decryptError) throw decryptError;
      return clientSecret;
    },
  };
  const controlledFetch = fetchImpl || (async (...args) => {
    calls.push(['fetch', ...args]);
    return createResponse();
  });

  return {
    calls,
    service: createApsTokenService({
      configurationService,
      encryption,
      fetchImpl: controlledFetch,
    }),
  };
}

test('uses only the current user stored credentials in the exact APS OAuth v2 exchange', async () => {
  const { calls, service } = createService();

  const result = await service.getViewerToken(userId);

  assert.deepEqual(result, {
    accessToken: 'synthetic-access-token',
    expiresIn: 3599,
  });
  assert.deepEqual(calls[0], ['getConfigurationForService', userId]);
  assert.deepEqual(calls[1], [
    'decryptClientSecret',
    { userId, envelope: secretEnvelope },
  ]);
  const [operation, url, options] = calls[2];
  assert.equal(operation, 'fetch');
  assert.equal(url, 'https://developer.api.autodesk.com/authentication/v2/token');
  assert.equal(options.method, 'POST');
  assert.equal(options.cache, 'no-store');
  assert.equal(options.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.equal(
    options.headers.Authorization,
    `Basic ${Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64')}`,
  );
  assert.equal(
    options.body,
    'grant_type=client_credentials&scope=viewables%3Aread',
  );
  assert.equal(options.signal instanceof AbortSignal, true);
  assert.equal(calls.filter(([name]) => name === 'fetch').length, 1);
});

test('rejects missing saved configuration before decryption or APS access', async () => {
  const { calls, service } = createService({ configuration: null });

  await assert.rejects(
    service.getViewerToken(userId),
    (error) => error.code === 'APS_CONFIGURATION_REQUIRED',
  );
  assert.deepEqual(calls, [['getConfigurationForService', userId]]);
});

test('does not contact APS when stored secret decryption fails', async () => {
  const decryptError = Object.assign(new Error('Synthetic safe decryption failure'), {
    code: 'APS_CLIENT_SECRET_DECRYPTION_FAILED',
  });
  const { calls, service } = createService({ decryptError });

  await assert.rejects(
    service.getViewerToken(userId),
    (error) => error.code === 'APS_CLIENT_SECRET_DECRYPTION_FAILED',
  );
  assert.equal(calls.some(([name]) => name === 'fetch'), false);
});

test('classifies rejected APS credentials without reading or exposing the upstream body', async () => {
  let jsonCalled = false;
  const { service } = createService({
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      async json() {
        jsonCalled = true;
        return { access_token: 'must-not-be-read-or-exposed' };
      },
    }),
  });

  await assert.rejects(
    service.getViewerToken(userId),
    (error) => {
      assert.equal(error.code, 'APS_CREDENTIALS_REJECTED');
      assert.equal(error.message.includes('must-not-be-read-or-exposed'), false);
      return true;
    },
  );
  assert.equal(jsonCalled, false);
});

test('classifies non-credential upstream failures as temporary without automatic retry', async () => {
  let fetchCount = 0;
  const { service } = createService({
    fetchImpl: async () => {
      fetchCount += 1;
      return createResponse({ ok: false, status: 503 });
    },
  });

  await assert.rejects(
    service.getViewerToken(userId),
    (error) => error.code === 'APS_TOKEN_TEMPORARY_FAILURE',
  );
  assert.equal(fetchCount, 1);
});

test('classifies a network failure without exposing its raw message', async () => {
  const rawMessage = 'Synthetic network failure containing synthetic-access-token';
  const { service } = createService({
    fetchImpl: async () => {
      throw new Error(rawMessage);
    },
  });

  await assert.rejects(
    service.getViewerToken(userId),
    (error) => {
      assert.equal(error.code, 'APS_TOKEN_TEMPORARY_FAILURE');
      assert.equal(error.message.includes(rawMessage), false);
      assert.equal(error.message.includes('synthetic-access-token'), false);
      return true;
    },
  );
});

test('aborts one APS request after exactly ten seconds and clears the timer', async () => {
  const timerCalls = [];
  const clearCalls = [];
  const fetchCalls = [];
  const service = createApsTokenService({
    configurationService: {
      async getConfigurationForService() {
        return { clientId, secretEnvelope };
      },
    },
    encryption: { decryptClientSecret: () => clientSecret },
    setTimeoutImpl(callback, duration) {
      timerCalls.push(duration);
      callback();
      return 'synthetic-timeout-id';
    },
    clearTimeoutImpl(timeoutId) {
      clearCalls.push(timeoutId);
    },
    async fetchImpl(_url, options) {
      fetchCalls.push(options);
      assert.equal(options.signal.aborted, true);
      throw Object.assign(new Error('Synthetic abort'), { name: 'AbortError' });
    },
  });

  await assert.rejects(
    service.getViewerToken(userId),
    (error) => error.code === 'APS_TOKEN_TEMPORARY_FAILURE',
  );
  assert.deepEqual(timerCalls, [10_000]);
  assert.deepEqual(clearCalls, ['synthetic-timeout-id']);
  assert.equal(fetchCalls.length, 1);
});

test('keeps the ten-second abort active until the successful response body is parsed', async () => {
  let timerCleared = false;
  const response = createResponse({
    jsonResult: {
      access_token: 'synthetic-access-token',
      expires_in: 3599,
    },
  });
  const originalJson = response.json;
  response.json = async () => {
    assert.equal(timerCleared, false);
    return originalJson();
  };
  const timedService = createApsTokenService({
    configurationService: {
      async getConfigurationForService() {
        return { clientId, secretEnvelope };
      },
    },
    encryption: { decryptClientSecret: () => clientSecret },
    setTimeoutImpl: () => 'synthetic-timeout-id',
    clearTimeoutImpl: () => {
      timerCleared = true;
    },
    fetchImpl: async () => response,
  });

  await timedService.getViewerToken(userId);

  assert.equal(timerCleared, true);
});

test('rejects malformed successful JSON as an invalid APS response', async () => {
  const { service } = createService({
    fetchImpl: async () => createResponse({
      jsonError: new Error('Synthetic body containing synthetic-access-token'),
    }),
  });

  await assert.rejects(
    service.getViewerToken(userId),
    (error) => {
      assert.equal(error.code, 'APS_TOKEN_INVALID_RESPONSE');
      assert.equal(error.message.includes('synthetic-access-token'), false);
      return true;
    },
  );
});

test('classifies an abort while reading the response body as temporary', async () => {
  const { service } = createService({
    fetchImpl: async () => createResponse({
      jsonError: Object.assign(new Error('Synthetic body abort'), {
        name: 'AbortError',
      }),
    }),
  });

  await assert.rejects(
    service.getViewerToken(userId),
    (error) => error.code === 'APS_TOKEN_TEMPORARY_FAILURE',
  );
});

const invalidPayloadCases = [
  ['missing token', { expires_in: 3599 }],
  ['empty token', { access_token: '', expires_in: 3599 }],
  ['zero lifetime', { access_token: 'synthetic-access-token', expires_in: 0 }],
  ['negative lifetime', { access_token: 'synthetic-access-token', expires_in: -1 }],
  ['non-numeric lifetime', { access_token: 'synthetic-access-token', expires_in: '3599' }],
  ['fractional lifetime', { access_token: 'synthetic-access-token', expires_in: 1.5 }],
];

for (const [label, jsonResult] of invalidPayloadCases) {
  test(`rejects an APS success payload with ${label}`, async () => {
    const { service } = createService({
      fetchImpl: async () => createResponse({ jsonResult }),
    });

    await assert.rejects(
      service.getViewerToken(userId),
      (error) => error.code === 'APS_TOKEN_INVALID_RESPONSE',
    );
  });
}
