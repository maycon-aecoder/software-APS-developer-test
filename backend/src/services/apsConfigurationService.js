const {
  APS_CONFIGURATION_PROJECTIONS,
} = require('../models/ApsConfiguration');

function createConfigurationError(code, message, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.name = 'ApsConfigurationError';
  error.code = code;
  return error;
}

function normalizeUserId(userId) {
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    throw createConfigurationError(
      'APS_CONFIGURATION_USER_REQUIRED',
      'The authenticated user context is required for APS configuration.',
    );
  }
  return userId;
}

function normalizeClientId(clientId) {
  if (typeof clientId !== 'string' || clientId.trim().length === 0) {
    throw createConfigurationError(
      'APS_CLIENT_ID_REQUIRED',
      'APS Client ID is required.',
    );
  }
  return clientId.trim();
}

function mapSafeConfiguration(configuration) {
  if (!configuration) return null;
  const value = typeof configuration.toObject === 'function'
    ? configuration.toObject()
    : configuration;

  return {
    clientId: value.clientId,
    modelUrn: value.modelUrn,
  };
}

function createApsConfigurationService({
  ApsConfiguration,
  canonicalizeModelUrn,
  encryption,
}) {
  if (!ApsConfiguration || !canonicalizeModelUrn || !encryption) {
    throw new TypeError('APS configuration service dependencies are required.');
  }

  async function readConfiguration(userId, projection) {
    const ownerId = normalizeUserId(userId);
    try {
      return await ApsConfiguration.findOne({ userId: ownerId })
        .select(projection)
        .lean();
    } catch (error) {
      throw createConfigurationError(
        'APS_CONFIGURATION_READ_FAILED',
        'The saved APS configuration could not be read.',
        error,
      );
    }
  }

  async function getConfiguration(userId) {
    return mapSafeConfiguration(
      await readConfiguration(userId, APS_CONFIGURATION_PROJECTIONS.safe),
    );
  }

  async function getConfigurationForService(userId) {
    return readConfiguration(userId, APS_CONFIGURATION_PROJECTIONS.service);
  }

  async function saveConfiguration(userId, input) {
    const ownerId = normalizeUserId(userId);
    const clientId = normalizeClientId(input?.clientId);
    const modelUrn = canonicalizeModelUrn(input?.modelUrn);
    const existing = await readConfiguration(
      ownerId,
      APS_CONFIGURATION_PROJECTIONS.service,
    );
    const submittedSecret = input?.clientSecret;
    if (submittedSecret !== undefined && typeof submittedSecret !== 'string') {
      throw createConfigurationError(
        'APS_CLIENT_SECRET_INVALID',
        'APS Client Secret must be text or blank.',
      );
    }
    const hasSubmittedSecret =
      typeof submittedSecret === 'string' && submittedSecret.trim().length > 0;

    if (
      !hasSubmittedSecret &&
      (!existing || existing.clientId !== clientId || !existing.secretEnvelope)
    ) {
      throw createConfigurationError(
        'APS_CLIENT_SECRET_REQUIRED',
        'APS Client Secret is required for this configuration.',
      );
    }

    const secretEnvelope = hasSubmittedSecret
      ? encryption.encryptClientSecret({
          userId: ownerId,
          clientSecret: submittedSecret,
        })
      : existing.secretEnvelope;

    const completeCurrentState = {
      userId: ownerId,
      clientId,
      modelUrn,
      secretEnvelope,
    };
    const changeType =
      !existing || existing.clientId !== clientId || hasSubmittedSecret
        ? 'credential-replacement'
        : 'urn-only';

    try {
      const saved = await ApsConfiguration.findOneAndUpdate(
        { userId: ownerId },
        { $set: completeCurrentState },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
          projection: APS_CONFIGURATION_PROJECTIONS.safe,
        },
      );
      return {
        configuration: mapSafeConfiguration(saved),
        changeType,
      };
    } catch (error) {
      if (error?.code === 11000) {
        throw createConfigurationError(
          'APS_CONFIGURATION_CONFLICT',
          'The APS configuration changed concurrently. Please retry.',
          error,
        );
      }
      throw createConfigurationError(
        'APS_CONFIGURATION_SAVE_FAILED',
        'The APS configuration could not be saved.',
        error,
      );
    }
  }

  return Object.freeze({
    getConfiguration,
    getConfigurationForService,
    saveConfiguration,
  });
}

module.exports = { createApsConfigurationService };
