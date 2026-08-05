const TOKEN_ERROR_RESPONSES = Object.freeze({
  APS_CONFIGURATION_REQUIRED: {
    status: 409,
    message: 'Save your APS settings before loading a model.',
  },
  APS_CREDENTIALS_REJECTED: {
    status: 422,
    message: 'APS could not authorize the saved credentials. Verify the Client ID and Client Secret.',
  },
  APS_TOKEN_INVALID_RESPONSE: {
    status: 502,
    message: 'APS returned an invalid access response. Try again.',
  },
  APS_TOKEN_TEMPORARY_FAILURE: {
    status: 503,
    message: 'APS access is temporarily unavailable. Check your connection and try again.',
  },
  APS_CONFIG_ENCRYPTION_KEY_INVALID: {
    status: 503,
    message: 'APS access cannot be requested right now. Contact the application administrator and try again.',
  },
  APS_CLIENT_SECRET_DECRYPTION_FAILED: {
    status: 500,
    message: 'Saved APS credentials could not be read securely. Re-enter them and try again.',
  },
  APS_CONFIGURATION_READ_FAILED: {
    status: 500,
    message: 'Saved APS settings could not be loaded. Try again.',
  },
});

function sanitizeDiagnosticCode(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^[A-Z0-9_]+$/.test(value)) return value;
  return undefined;
}

function createSafeDiagnostics(error, publicCode) {
  return {
    operation: 'request-viewer-token',
    code: publicCode,
    errorName: error?.name || 'Error',
    causeName: error?.cause?.name,
    causeCode: sanitizeDiagnosticCode(error?.cause?.code),
    stackFrames: typeof error?.stack === 'string'
      ? error.stack.split('\n').slice(1).join('\n')
      : undefined,
  };
}

function respondWithFailure(error, logger, res) {
  const mapped = Object.prototype.hasOwnProperty.call(
    TOKEN_ERROR_RESPONSES,
    error?.code,
  )
    ? TOKEN_ERROR_RESPONSES[error.code]
    : undefined;
  const response = mapped
    ? { code: error.code, ...mapped }
    : {
        code: 'APS_TOKEN_INTERNAL_ERROR',
        status: 500,
        message: 'APS access could not be requested because of an unexpected error. Try again.',
      };

  logger.error(
    'APS Viewer token operation failed',
    createSafeDiagnostics(error, response.code),
  );

  return res.status(response.status).json({
    code: response.code,
    message: response.message,
    fieldErrors: {},
  });
}

function createApsTokenController({ logger = console, tokenService }) {
  async function getViewerToken(req, res) {
    try {
      const token = await tokenService.getViewerToken(req.user.id);
      return res.json({
        accessToken: token.accessToken,
        expiresIn: token.expiresIn,
      });
    } catch (error) {
      return respondWithFailure(error, logger, res);
    }
  }

  return { getViewerToken };
}

module.exports = { createApsTokenController };
