const assert = require('node:assert/strict');
const { existsSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const subjectPath = path.join(__dirname, '../../src/services/apsConfigurationService.js');
const subject = existsSync(subjectPath)
  ? require(subjectPath)
  : {
      createApsConfigurationService: () => ({
        getConfiguration: async () => undefined,
        getConfigurationForService: async () => undefined,
        saveConfiguration: async () => undefined,
      }),
    };

const { createApsConfigurationService } = subject;
const { canonicalizeModelUrn } = require('../../src/domain/modelUrn');

const userId = '66b28e44b8967d23c43e9371';
const otherUserId = '66b28e44b8967d23c43e9372';
const existingEnvelope = Object.freeze({
  version: 1,
  ciphertext: 'existing-ciphertext',
  iv: 'existing-iv',
  authTag: 'existing-auth-tag',
});
const newEnvelope = Object.freeze({
  version: 1,
  ciphertext: 'new-ciphertext',
  iv: 'new-iv',
  authTag: 'new-auth-tag',
});

function clone(value) {
  return value === null || value === undefined
    ? value
    : JSON.parse(JSON.stringify(value));
}

function applyProjection(document, projection) {
  if (!document) return document;

  const projected = {};
  for (const [field, included] of Object.entries(projection || {})) {
    if (included === 1 && document[field] !== undefined) {
      projected[field] = clone(document[field]);
    }
  }
  return projected;
}

function createModelDouble(initialDocument = null) {
  let state = clone(initialDocument);
  let nextWriteError = null;
  const calls = [];

  const model = {
    findOne(filter) {
      const call = { operation: 'findOne', filter: clone(filter), projection: null };
      calls.push(call);

      return {
        select(projection) {
          call.projection = clone(projection);
          return this;
        },
        async lean() {
          return applyProjection(state, call.projection);
        },
      };
    },
    async findOneAndUpdate(filter, update, options) {
      calls.push({
        operation: 'findOneAndUpdate',
        filter: clone(filter),
        update: clone(update),
        options: clone(options),
      });

      if (nextWriteError) {
        throw nextWriteError;
      }

      state = clone(update.$set);
      return applyProjection(state, options.projection);
    },
  };

  return {
    calls,
    model,
    failNextWrite(error) {
      nextWriteError = error;
    },
    getState() {
      return clone(state);
    },
  };
}

function createEncryptionDouble(overrides = {}) {
  const calls = [];

  return {
    calls,
    encryptClientSecret(input) {
      calls.push(clone(input));
      if (overrides.error) throw overrides.error;
      return clone(overrides.envelope || newEnvelope);
    },
  };
}

function createService({ initialDocument = null, encryption, modelDouble } = {}) {
  const controlledModel = modelDouble || createModelDouble(initialDocument);
  const controlledEncryption = encryption || createEncryptionDouble();
  const service = createApsConfigurationService({
    ApsConfiguration: controlledModel.model,
    canonicalizeModelUrn,
    encryption: controlledEncryption,
  });

  return {
    controlledEncryption,
    controlledModel,
    service,
  };
}

test('creates one complete per-user configuration atomically without persisting plaintext', async () => {
  const { controlledEncryption, controlledModel, service } = createService();

  const result = await service.saveConfiguration(userId, {
    userId: otherUserId,
    clientId: '  synthetic-client-id  ',
    clientSecret: 'synthetic-client-secret',
    modelUrn: ' urn:dGVzdC1tb2RlbA ',
  });

  assert.deepEqual(controlledEncryption.calls, [
    { userId, clientSecret: 'synthetic-client-secret' },
  ]);
  const write = controlledModel.calls.find(
    ({ operation }) => operation === 'findOneAndUpdate',
  );
  assert.equal(
    controlledModel.calls.filter(({ operation }) => operation === 'findOneAndUpdate').length,
    1,
  );
  assert.deepEqual(write.filter, { userId });
  assert.deepEqual(write.update, {
    $set: {
      userId,
      clientId: 'synthetic-client-id',
      modelUrn: 'dGVzdC1tb2RlbA',
      secretEnvelope: newEnvelope,
    },
  });
  assert.deepEqual(
    {
      new: write.options.new,
      upsert: write.options.upsert,
      runValidators: write.options.runValidators,
      setDefaultsOnInsert: write.options.setDefaultsOnInsert,
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  assert.equal(write.options.projection.secretEnvelope, undefined);
  assert.equal(JSON.stringify(write.update).includes('synthetic-client-secret'), false);
  assert.deepEqual(result, {
    clientId: 'synthetic-client-id',
    modelUrn: 'dGVzdC1tb2RlbA',
  });
});

test('retains the exact previous envelope when the client ID is unchanged and secret is blank', async () => {
  const initialDocument = {
    userId,
    clientId: 'synthetic-client-id',
    modelUrn: 'b2xkLW1vZGVs',
    secretEnvelope: existingEnvelope,
  };
  const { controlledEncryption, controlledModel, service } = createService({ initialDocument });

  await service.saveConfiguration(userId, {
    clientId: ' synthetic-client-id ',
    clientSecret: '   ',
    modelUrn: 'bmV3LW1vZGVs',
  });

  assert.equal(controlledEncryption.calls.length, 0);
  assert.deepEqual(controlledModel.getState(), {
    userId,
    clientId: 'synthetic-client-id',
    modelUrn: 'bmV3LW1vZGVs',
    secretEnvelope: existingEnvelope,
  });
});

const invalidSecretRuleCases = [
  ['a first save without a secret', null, 'synthetic-client-id'],
  [
    'a changed client ID without a replacement secret',
    {
      userId,
      clientId: 'synthetic-client-id',
      modelUrn: 'b2xkLW1vZGVs',
      secretEnvelope: existingEnvelope,
    },
    'replacement-client-id',
  ],
];

for (const [label, initialDocument, clientId] of invalidSecretRuleCases) {
  test(`rejects ${label} before persistence`, async () => {
    const { controlledModel, service } = createService({ initialDocument });

    await assert.rejects(
      service.saveConfiguration(userId, {
        clientId,
        clientSecret: '',
        modelUrn: 'dGVzdC1tb2RlbA',
      }),
      (error) => error.code === 'APS_CLIENT_SECRET_REQUIRED',
    );
    assert.equal(
      controlledModel.calls.some(({ operation }) => operation === 'findOneAndUpdate'),
      false,
    );
  });
}

test('reads safe and service configurations with server-derived user filters and explicit projections', async () => {
  const initialDocument = {
    userId,
    clientId: 'synthetic-client-id',
    modelUrn: 'dGVzdC1tb2RlbA',
    secretEnvelope: existingEnvelope,
  };
  const { controlledModel, service } = createService({ initialDocument });

  const safe = await service.getConfiguration(userId);
  const internal = await service.getConfigurationForService(userId);

  const reads = controlledModel.calls.filter(({ operation }) => operation === 'findOne');
  assert.deepEqual(reads.map(({ filter }) => filter), [{ userId }, { userId }]);
  assert.equal(reads[0].projection.secretEnvelope, undefined);
  assert.equal(reads[1].projection.secretEnvelope, 1);
  assert.equal(safe.secretEnvelope, undefined);
  assert.deepEqual(internal.secretEnvelope, existingEnvelope);
});

test('does not write or alter the previous document when encryption fails', async () => {
  const initialDocument = {
    userId,
    clientId: 'synthetic-client-id',
    modelUrn: 'b2xkLW1vZGVs',
    secretEnvelope: existingEnvelope,
  };
  const encryptionError = Object.assign(new Error('Encryption failed safely'), {
    code: 'APS_CLIENT_SECRET_ENCRYPTION_FAILED',
  });
  const controlledEncryption = createEncryptionDouble({ error: encryptionError });
  const { controlledModel, service } = createService({
    initialDocument,
    encryption: controlledEncryption,
  });

  await assert.rejects(
    service.saveConfiguration(userId, {
      clientId: 'replacement-client-id',
      clientSecret: 'replacement-secret',
      modelUrn: 'bmV3LW1vZGVs',
    }),
    (error) => error.code === 'APS_CLIENT_SECRET_ENCRYPTION_FAILED',
  );
  assert.deepEqual(controlledModel.getState(), initialDocument);
  assert.equal(
    controlledModel.calls.some(({ operation }) => operation === 'findOneAndUpdate'),
    false,
  );
});

const writeFailureCases = [
  ['duplicate user index', Object.assign(new Error('duplicate key'), { code: 11000 }), 'APS_CONFIGURATION_CONFLICT'],
  ['database write', new Error('synthetic database unavailable'), 'APS_CONFIGURATION_SAVE_FAILED'],
];

for (const [label, writeError, expectedCode] of writeFailureCases) {
  test(`preserves the previous document and sanitizes a ${label} failure`, async () => {
    const initialDocument = {
      userId,
      clientId: 'synthetic-client-id',
      modelUrn: 'b2xkLW1vZGVs',
      secretEnvelope: existingEnvelope,
    };
    const controlledModel = createModelDouble(initialDocument);
    controlledModel.failNextWrite(writeError);
    const { service } = createService({ modelDouble: controlledModel });

    await assert.rejects(
      service.saveConfiguration(userId, {
        clientId: 'replacement-client-id',
        clientSecret: 'replacement-secret',
        modelUrn: 'bmV3LW1vZGVs',
      }),
      (error) => {
        assert.equal(error.code, expectedCode);
        assert.doesNotMatch(error.message, /duplicate key|database unavailable/i);
        return true;
      },
    );
    assert.deepEqual(controlledModel.getState(), initialDocument);
  });
}
