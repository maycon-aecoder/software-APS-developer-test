const crypto = require('node:crypto');

const ALGORITHM = 'aes-256-gcm';
const ENVELOPE_VERSION = 1;
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const KEY_LENGTH_BYTES = 32;
const STANDARD_BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function createSecurityError(code, message, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.name = 'ApsConfigSecurityError';
  error.code = code;
  return error;
}

function decodeCanonicalBase64(value) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    !STANDARD_BASE64_PATTERN.test(value)
  ) {
    throw new Error('Invalid Base64 encoding');
  }

  const decoded = Buffer.from(value, 'base64');
  if (decoded.toString('base64') !== value) {
    throw new Error('Noncanonical Base64 encoding');
  }

  return decoded;
}

function parseApsConfigEncryptionKey(encodedKey) {
  try {
    const decodedKey = decodeCanonicalBase64(encodedKey);
    if (decodedKey.length !== KEY_LENGTH_BYTES) {
      throw new Error('Incorrect key length');
    }
    return decodedKey;
  } catch (error) {
    throw createSecurityError(
      'APS_CONFIG_ENCRYPTION_KEY_INVALID',
      'APS configuration encryption is unavailable because its server key is invalid.',
      error,
    );
  }
}

function createAdditionalAuthenticatedData(userId) {
  if (typeof userId !== 'string' || userId.length === 0) {
    throw createSecurityError(
      'APS_CLIENT_SECRET_ENCRYPTION_FAILED',
      'The APS Client Secret could not be protected.',
    );
  }

  return Buffer.from(`aps-configuration:${userId}`, 'utf8');
}

function createApsConfigEncryption(encodedKey) {
  const key = Buffer.from(parseApsConfigEncryptionKey(encodedKey));

  function encryptClientSecret({ userId, clientSecret }) {
    if (typeof clientSecret !== 'string' || clientSecret.length === 0) {
      throw createSecurityError(
        'APS_CLIENT_SECRET_ENCRYPTION_FAILED',
        'The APS Client Secret could not be protected.',
      );
    }

    try {
      const iv = crypto.randomBytes(IV_LENGTH_BYTES);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH_BYTES,
      });
      cipher.setAAD(createAdditionalAuthenticatedData(userId));
      const ciphertext = Buffer.concat([
        cipher.update(clientSecret, 'utf8'),
        cipher.final(),
      ]);

      return {
        version: ENVELOPE_VERSION,
        ciphertext: ciphertext.toString('base64'),
        iv: iv.toString('base64'),
        authTag: cipher.getAuthTag().toString('base64'),
      };
    } catch (error) {
      if (error.code === 'APS_CLIENT_SECRET_ENCRYPTION_FAILED') throw error;
      throw createSecurityError(
        'APS_CLIENT_SECRET_ENCRYPTION_FAILED',
        'The APS Client Secret could not be protected.',
        error,
      );
    }
  }

  function decryptClientSecret({ userId, envelope }) {
    try {
      if (!envelope || envelope.version !== ENVELOPE_VERSION) {
        throw new Error('Unsupported secret envelope');
      }

      const iv = decodeCanonicalBase64(envelope.iv);
      const authTag = decodeCanonicalBase64(envelope.authTag);
      const ciphertext = decodeCanonicalBase64(envelope.ciphertext);
      if (iv.length !== IV_LENGTH_BYTES || authTag.length !== AUTH_TAG_LENGTH_BYTES) {
        throw new Error('Invalid secret envelope');
      }

      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH_BYTES,
      });
      decipher.setAAD(createAdditionalAuthenticatedData(userId));
      decipher.setAuthTag(authTag);

      return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString('utf8');
    } catch (error) {
      throw createSecurityError(
        'APS_CLIENT_SECRET_DECRYPTION_FAILED',
        'The stored APS Client Secret could not be read securely.',
        error,
      );
    }
  }

  return Object.freeze({ decryptClientSecret, encryptClientSecret });
}

module.exports = {
  createApsConfigEncryption,
  parseApsConfigEncryptionKey,
};
