const assert = require('node:assert/strict');
const { existsSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const subjectPath = path.join(__dirname, '../../src/security/apsConfigEncryption.js');
const subject = existsSync(subjectPath)
  ? require(subjectPath)
  : {
      createApsConfigEncryption: () => ({
        decryptClientSecret: () => undefined,
        encryptClientSecret: () => ({
          version: 0,
          ciphertext: '',
          iv: '',
          authTag: '',
        }),
      }),
      parseApsConfigEncryptionKey: () => undefined,
    };

const {
  createApsConfigEncryption,
  parseApsConfigEncryptionKey,
} = subject;
const { createEncryptionKeyFixture } = require('../fixtures/apsFixtures');

const userId = '66b28e44b8967d23c43e9371';
const clientSecret = 'synthetic-client-secret-for-tests';

function createNoncanonicalEquivalent(encodedKey) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lastDataIndex = encodedKey.length - 2;
  const canonicalValue = alphabet.indexOf(encodedKey[lastDataIndex]);
  const replacementValue = (canonicalValue & 0b111100) | 0b000001;

  return `${encodedKey.slice(0, lastDataIndex)}${alphabet[replacementValue]}=`;
}

function mutateBase64(value) {
  return `${value[0] === 'A' ? 'B' : 'A'}${value.slice(1)}`;
}

test('accepts only a canonical standard-Base64 key that decodes to exactly 32 bytes', () => {
  const encodedKey = createEncryptionKeyFixture();

  assert.deepEqual(parseApsConfigEncryptionKey(encodedKey), Buffer.alloc(32, 7));
});

const invalidKeyCases = [
  ['missing value', undefined],
  ['empty value', ''],
  ['surrounding whitespace', ` ${createEncryptionKeyFixture()} `],
  ['31 decoded bytes', Buffer.alloc(31, 7).toString('base64')],
  ['33 decoded bytes', Buffer.alloc(33, 7).toString('base64')],
  ['missing padding', createEncryptionKeyFixture().slice(0, -1)],
  ['invalid padding placement', `${createEncryptionKeyFixture().slice(0, -1)}=A`],
  ['URL-safe alphabet', Buffer.alloc(32, 251).toString('base64url')],
  ['noncanonical trailing bits', createNoncanonicalEquivalent(createEncryptionKeyFixture())],
];

for (const [label, value] of invalidKeyCases) {
  test(`rejects an encryption key with ${label}`, () => {
    assert.throws(
      () => parseApsConfigEncryptionKey(value),
      (error) => error.code === 'APS_CONFIG_ENCRYPTION_KEY_INVALID',
      `Expected ${label} to be rejected with the stable key-validation code`,
    );
  });
}

test('encrypts the same secret into randomized versioned AES-GCM envelopes', () => {
  const encryption = createApsConfigEncryption(createEncryptionKeyFixture());

  const first = encryption.encryptClientSecret({ userId, clientSecret });
  const second = encryption.encryptClientSecret({ userId, clientSecret });

  assert.equal(first.version, 1);
  assert.equal(second.version, 1);
  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.ciphertext, second.ciphertext);
  assert.equal(Buffer.from(first.iv, 'base64').length, 12);
  assert.equal(Buffer.from(first.authTag, 'base64').length, 16);
  assert.equal(
    encryption.decryptClientSecret({ userId, envelope: first }),
    clientSecret,
  );
  assert.equal(
    encryption.decryptClientSecret({ userId, envelope: second }),
    clientSecret,
  );
});

const rejectionCases = [
  ['another user', ({ envelope }) => ({ userId: '66b28e44b8967d23c43e9372', envelope })],
  [
    'tampered ciphertext',
    ({ envelope }) => ({
      userId,
      envelope: { ...envelope, ciphertext: mutateBase64(envelope.ciphertext) },
    }),
  ],
  [
    'tampered authentication tag',
    ({ envelope }) => ({
      userId,
      envelope: { ...envelope, authTag: mutateBase64(envelope.authTag) },
    }),
  ],
  [
    'tampered initialization vector',
    ({ envelope }) => ({
      userId,
      envelope: { ...envelope, iv: mutateBase64(envelope.iv) },
    }),
  ],
  [
    'an unsupported envelope version',
    ({ envelope }) => ({ userId, envelope: { ...envelope, version: 2 } }),
  ],
];

for (const [label, createAttempt] of rejectionCases) {
  test(`rejects decryption with ${label} without exposing sensitive material`, () => {
    const encryption = createApsConfigEncryption(createEncryptionKeyFixture());
    const envelope = encryption.encryptClientSecret({ userId, clientSecret });

    assert.throws(
      () => encryption.decryptClientSecret(createAttempt({ envelope })),
      (error) => {
        assert.equal(error.code, 'APS_CLIENT_SECRET_DECRYPTION_FAILED');
        assert.doesNotMatch(error.message, new RegExp(clientSecret, 'i'));
        assert.doesNotMatch(error.message, new RegExp(envelope.ciphertext, 'i'));
        return true;
      },
    );
  });
}

test('rejects decryption with a different key without exposing either key', () => {
  const encodedKey = createEncryptionKeyFixture(7);
  const otherEncodedKey = createEncryptionKeyFixture(8);
  const envelope = createApsConfigEncryption(encodedKey).encryptClientSecret({
    userId,
    clientSecret,
  });

  assert.throws(
    () =>
      createApsConfigEncryption(otherEncodedKey).decryptClientSecret({
        userId,
        envelope,
      }),
    (error) => {
      assert.equal(error.code, 'APS_CLIENT_SECRET_DECRYPTION_FAILED');
      assert.doesNotMatch(error.message, new RegExp(encodedKey, 'i'));
      assert.doesNotMatch(error.message, new RegExp(otherEncodedKey, 'i'));
      return true;
    },
  );
});
