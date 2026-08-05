const ERROR_RESPONSES = Object.freeze({
  APS_CLIENT_ID_REQUIRED: {
    status: 400,
    message: 'Check the APS Client ID and try again.',
    fieldErrors: { clientId: 'Enter your APS Client ID.' },
  },
  APS_CLIENT_SECRET_REQUIRED: {
    status: 400,
    message: 'Check the APS Client Secret and try again.',
    fieldErrors: {
      clientSecret: 'Enter the APS Client Secret when setting up APS or changing the Client ID.',
    },
  },
  APS_CLIENT_SECRET_INVALID: {
    status: 400,
    message: 'Check the APS Client Secret and try again.',
    fieldErrors: {
      clientSecret: 'Enter the APS Client Secret as text, or leave it blank to keep the saved secret.',
    },
  },
  INVALID_MODEL_URN: {
    status: 400,
    message: 'Check the Model URN and try again.',
    fieldErrors: {
      modelUrn: 'Enter an unpadded Base64URL source-design URN with no prefix or one lowercase "urn:" prefix.',
    },
  },
  APS_CONFIGURATION_CONFLICT: {
    status: 409,
    message: 'APS settings changed during this save. Reload them and try again.',
    fieldErrors: {},
  },
  APS_CONFIG_ENCRYPTION_KEY_INVALID: {
    status: 503,
    message: 'APS settings cannot be saved right now. Contact the application administrator and try again.',
    fieldErrors: {},
  },
  APS_CLIENT_SECRET_ENCRYPTION_FAILED: {
    status: 500,
    message: 'APS settings could not be secured and were not saved. Try again.',
    fieldErrors: {},
  },
  APS_CONFIGURATION_SAVE_FAILED: {
    status: 500,
    message: 'APS settings were not saved. Try again.',
    fieldErrors: {},
  },
  APS_CONFIGURATION_READ_FAILED: {
    status: 500,
    message: 'Saved APS settings could not be loaded. Try again.',
    fieldErrors: {},
  },
});

function mapSafeConfiguration(configuration) {
  return {
    clientId: configuration.clientId,
    modelUrn: configuration.modelUrn,
    hasClientSecret: true,
  };
}

function sanitizeDiagnosticCode(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^[A-Z0-9_]+$/.test(value)) return value;
  return undefined;
}

function createSafeDiagnostics(error, operation, publicCode) {
  const stackFrames = typeof error?.stack === 'string'
    ? error.stack.split('\n').slice(1).join('\n')
    : undefined;

  return {
    operation,
    code: publicCode,
    errorName: error?.name || 'Error',
    causeName: error?.cause?.name,
    causeCode: sanitizeDiagnosticCode(error?.cause?.code),
    stackFrames,
  };
}

function createInternalResponse(operation) {
  return {
    code: 'APS_CONFIGURATION_INTERNAL_ERROR',
    status: 500,
    message: operation === 'read-configuration'
      ? 'Saved APS settings could not be loaded because of an unexpected error. Try again.'
      : 'APS settings could not be saved because of an unexpected error. Try again.',
    fieldErrors: {},
  };
}

function respondWithFailure({ error, logger, operation, res }) {
  const mapped = Object.prototype.hasOwnProperty.call(ERROR_RESPONSES, error?.code)
    ? ERROR_RESPONSES[error.code]
    : undefined;
  const response = mapped
    ? { code: error.code, ...mapped }
    : createInternalResponse(operation);

  if (response.status >= 409) {
    logger.error(
      'APS configuration operation failed',
      createSafeDiagnostics(error, operation, response.code),
    );
  }

  return res.status(response.status).json({
    code: response.code,
    message: response.message,
    fieldErrors: response.fieldErrors,
  });
}

function createApsConfigurationController({ configurationService, logger = console }) {
  async function getConfiguration(req, res) {
    try {
      const configuration = await configurationService.getConfiguration(req.user.id);
      if (!configuration) {
        return res.json({ configured: false, configuration: null });
      }

      return res.json({
        configured: true,
        configuration: mapSafeConfiguration(configuration),
      });
    } catch (error) {
      return respondWithFailure({
        error,
        logger,
        operation: 'read-configuration',
        res,
      });
    }
  }

  async function saveConfiguration(req, res) {
    try {
      const result = await configurationService.saveConfiguration(req.user.id, {
        clientId: req.body?.clientId,
        clientSecret: req.body?.clientSecret,
        modelUrn: req.body?.modelUrn,
      });

      return res.json({
        configured: true,
        configuration: mapSafeConfiguration(result.configuration),
        changeType: result.changeType,
      });
    } catch (error) {
      return respondWithFailure({
        error,
        logger,
        operation: 'save-configuration',
        res,
      });
    }
  }

  return { getConfiguration, saveConfiguration };
}

module.exports = { createApsConfigurationController };
