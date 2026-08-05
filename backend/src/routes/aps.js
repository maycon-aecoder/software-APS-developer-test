const express = require('express');
const { createApsConfigurationController } = require('../controllers/apsConfigurationController');
const { canonicalizeModelUrn } = require('../domain/modelUrn');
const authMiddleware = require('../middleware/auth');
const { ApsConfiguration } = require('../models/ApsConfiguration');
const { createApsConfigEncryption } = require('../security/apsConfigEncryption');
const { createApsConfigurationService } = require('../services/apsConfigurationService');

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

function createDefaultConfigurationService() {
  return createApsConfigurationService({
    ApsConfiguration,
    canonicalizeModelUrn,
    encryption: createEnvironmentEncryption(),
  });
}

function createApsRouter({
  configurationService = createDefaultConfigurationService(),
  logger = console,
} = {}) {
  const router = express.Router();
  const controller = createApsConfigurationController({
    configurationService,
    logger,
  });

  router.use(authMiddleware);
  router.get('/configuration', controller.getConfiguration);
  router.put('/configuration', controller.saveConfiguration);

  return router;
}

const apsRouter = createApsRouter();

module.exports = apsRouter;
module.exports.createApsRouter = createApsRouter;
