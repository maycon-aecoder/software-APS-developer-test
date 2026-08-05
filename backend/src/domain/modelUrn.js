const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const VIEWER_URN_PREFIX = 'urn:';

function createInvalidModelUrnError() {
  const error = new Error(
    'Enter an unpadded Base64URL source-design URN with no prefix or one lowercase "urn:" prefix.',
  );
  error.code = 'INVALID_MODEL_URN';
  return error;
}

function canonicalizeModelUrn(input) {
  if (typeof input !== 'string') {
    throw createInvalidModelUrnError();
  }

  const trimmedInput = input.trim();
  const payload = trimmedInput.startsWith(VIEWER_URN_PREFIX)
    ? trimmedInput.slice(VIEWER_URN_PREFIX.length)
    : trimmedInput;

  if (
    !payload
    || !BASE64URL_PATTERN.test(payload)
    || payload.length % 4 === 1
  ) {
    throw createInvalidModelUrnError();
  }

  let canonicalPayload;
  try {
    canonicalPayload = Buffer.from(payload, 'base64url').toString('base64url');
  } catch {
    throw createInvalidModelUrnError();
  }

  if (canonicalPayload !== payload) {
    throw createInvalidModelUrnError();
  }

  return payload;
}

module.exports = { canonicalizeModelUrn };
