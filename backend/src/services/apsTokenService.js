const APS_TOKEN_URL = 'https://developer.api.autodesk.com/authentication/v2/token';
const TOKEN_TIMEOUT_MS = 10_000;

function createTokenError(code, message, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.name = 'ApsTokenError';
  error.code = code;
  return error;
}

function createApsTokenService({
  clearTimeoutImpl = clearTimeout,
  configurationService,
  encryption,
  fetchImpl = fetch,
  setTimeoutImpl = setTimeout,
}) {
  if (!configurationService || !encryption || typeof fetchImpl !== 'function') {
    throw new TypeError('APS token service dependencies are required.');
  }

  async function getViewerToken(userId) {
    const configuration = await configurationService.getConfigurationForService(userId);
    if (!configuration) {
      throw createTokenError(
        'APS_CONFIGURATION_REQUIRED',
        'APS configuration is required before requesting Viewer access.',
      );
    }

    const clientSecret = encryption.decryptClientSecret({
      userId,
      envelope: configuration.secretEnvelope,
    });
    const authorization = Buffer.from(
      `${configuration.clientId}:${clientSecret}`,
      'utf8',
    ).toString('base64');
    const abortController = new AbortController();
    const timeoutId = setTimeoutImpl(
      () => abortController.abort(),
      TOKEN_TIMEOUT_MS,
    );

    try {
      let response;
      try {
        response = await fetchImpl(APS_TOKEN_URL, {
          method: 'POST',
          cache: 'no-store',
          headers: {
            Authorization: `Basic ${authorization}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            scope: 'viewables:read',
          }).toString(),
          signal: abortController.signal,
        });
      } catch (error) {
        throw createTokenError(
          'APS_TOKEN_TEMPORARY_FAILURE',
          'APS access is temporarily unavailable.',
          error,
        );
      }

      if (!response || typeof response.ok !== 'boolean') {
        throw createTokenError(
          'APS_TOKEN_INVALID_RESPONSE',
          'APS returned an invalid access response.',
        );
      }

      if (!response.ok) {
        if ([400, 401, 403].includes(response.status)) {
          throw createTokenError(
            'APS_CREDENTIALS_REJECTED',
            'APS rejected the saved credentials.',
          );
        }
        throw createTokenError(
          'APS_TOKEN_TEMPORARY_FAILURE',
          'APS access is temporarily unavailable.',
        );
      }

      let payload;
      try {
        payload = await response.json();
      } catch (error) {
        if (error?.name === 'AbortError') {
          throw createTokenError(
            'APS_TOKEN_TEMPORARY_FAILURE',
            'APS access is temporarily unavailable.',
            error,
          );
        }
        throw createTokenError(
          'APS_TOKEN_INVALID_RESPONSE',
          'APS returned an invalid access response.',
          error,
        );
      }

      if (
        typeof payload?.access_token !== 'string' ||
        payload.access_token.trim().length === 0 ||
        !Number.isInteger(payload.expires_in) ||
        payload.expires_in <= 0
      ) {
        throw createTokenError(
          'APS_TOKEN_INVALID_RESPONSE',
          'APS returned an invalid access response.',
        );
      }

      return {
        accessToken: payload.access_token,
        expiresIn: payload.expires_in,
      };
    } finally {
      clearTimeoutImpl(timeoutId);
    }
  }

  return Object.freeze({ getViewerToken });
}

module.exports = { createApsTokenService };
