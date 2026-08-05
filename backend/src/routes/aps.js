const express = require('express');
const { createApsConfigurationController } = require('../controllers/apsConfigurationController');
const { createApsTokenController } = require('../controllers/apsTokenController');
const { canonicalizeModelUrn } = require('../domain/modelUrn');
const authMiddleware = require('../middleware/auth');
const { ApsConfiguration } = require('../models/ApsConfiguration');
const { createApsConfigEncryption } = require('../security/apsConfigEncryption');
const { createApsConfigurationService } = require('../services/apsConfigurationService');
const { createApsTokenService } = require('../services/apsTokenService');

function createEnvironmentEncryption() {
  return {
    decryptClientSecret(input) {
      return createApsConfigEncryption(
        process.env.APS_CONFIG_ENCRYPTION_KEY,
      ).decryptClientSecret(input);
    },
    encryptClientSecret(input) {
      return createApsConfigEncryption(
        process.env.APS_CONFIG_ENCRYPTION_KEY,
      ).encryptClientSecret(input);
    },
  };
}

function createDefaultConfigurationService(encryption) {
  return createApsConfigurationService({
    ApsConfiguration,
    canonicalizeModelUrn,
    encryption,
  });
}

function createApsRouter({
  configurationService,
  logger = console,
  tokenService,
} = {}) {
  const router = express.Router();
  const environmentEncryption = createEnvironmentEncryption();
  const resolvedConfigurationService =
    configurationService || createDefaultConfigurationService(environmentEncryption);
  const resolvedTokenService = tokenService || createApsTokenService({
    configurationService: resolvedConfigurationService,
    encryption: environmentEncryption,
  });
  const controller = createApsConfigurationController({
    configurationService: resolvedConfigurationService,
    logger,
  });
  const tokenController = createApsTokenController({
    logger,
    tokenService: resolvedTokenService,
  });

  router.use(authMiddleware);
  router.get('/configuration', controller.getConfiguration);
  router.put('/configuration', controller.saveConfiguration);
  router.post('/token', tokenController.getViewerToken);

  return router;
}

const apsRouter = createApsRouter();

module.exports = apsRouter;
module.exports.createApsRouter = createApsRouter;
