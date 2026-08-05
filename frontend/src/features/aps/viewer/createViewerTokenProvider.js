import { requestViewerToken } from '../api/token';

const CONTEXT_FIELDS = [
  'userId',
  'workspaceId',
  'authenticationGeneration',
  'runtimeGeneration',
];

function hasValidTokenResult(result) {
  return (
    typeof result?.accessToken === 'string' &&
    result.accessToken.trim().length > 0 &&
    Number.isInteger(result.expiresIn) &&
    result.expiresIn > 0
  );
}

function normalizeTokenError(error) {
  const candidate = error?.response?.data?.code || error?.code;
  return {
    code: typeof candidate === 'string' && /^APS_[A-Z0-9_]+$/.test(candidate)
      ? candidate
      : 'APS_TOKEN_REQUEST_FAILED',
  };
}

export function createViewerTokenProvider({ requestToken = requestViewerToken } = {}) {
  if (typeof requestToken !== 'function') {
    throw new TypeError('A Viewer token request function is required.');
  }

  let activeRegistration = null;
  let nextRegistrationId = 0;

  function registerContext(context) {
    const registrationId = ++nextRegistrationId;
    const onError = context.onError;
    const capturedContext = Object.fromEntries(
      CONTEXT_FIELDS.map((field) => [field, context[field]]),
    );
    activeRegistration = { registrationId, ...capturedContext };

    function isCurrent() {
      return (
        activeRegistration?.registrationId === registrationId &&
        CONTEXT_FIELDS.every(
          (field) => activeRegistration[field] === capturedContext[field],
        )
      );
    }

    function getAccessToken(onTokenReady) {
      if (!isCurrent() || typeof onTokenReady !== 'function') return undefined;

      void Promise.resolve()
        .then(() => (isCurrent() ? requestToken() : undefined))
        .then((result) => {
          if (!isCurrent()) return;
          if (!hasValidTokenResult(result)) {
            throw Object.assign(new Error('Invalid token response'), {
              code: 'APS_TOKEN_INVALID_RESPONSE',
            });
          }
          onTokenReady(result.accessToken, result.expiresIn);
        })
        .catch((error) => {
          if (!isCurrent()) return;
          onError?.(normalizeTokenError(error));
        });

      return undefined;
    }

    function release() {
      if (isCurrent()) activeRegistration = null;
    }

    return Object.freeze({ getAccessToken, release });
  }

  function clear() {
    activeRegistration = null;
  }

  return Object.freeze({ clear, registerContext });
}
