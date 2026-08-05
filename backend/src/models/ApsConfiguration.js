const mongoose = require('mongoose');

const secretEnvelopeSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true, enum: [1] },
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
  },
  { _id: false },
);

const apsConfigurationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
    clientId: {
      type: String,
      required: true,
      trim: true,
    },
    modelUrn: {
      type: String,
      required: true,
    },
    secretEnvelope: {
      type: secretEnvelopeSchema,
      required: true,
      select: false,
    },
  },
  {
    autoIndex: true,
    timestamps: true,
    toJSON: {
      transform(_document, representation) {
        delete representation.secretEnvelope;
        return representation;
      },
    },
  },
);

apsConfigurationSchema.index({ userId: 1 }, { unique: true });

const APS_CONFIGURATION_PROJECTIONS = Object.freeze({
  safe: Object.freeze({
    _id: 0,
    clientId: 1,
    modelUrn: 1,
  }),
  service: Object.freeze({
    _id: 0,
    clientId: 1,
    modelUrn: 1,
    secretEnvelope: 1,
  }),
});

const ApsConfiguration =
  mongoose.models.ApsConfiguration ||
  mongoose.model('ApsConfiguration', apsConfigurationSchema);

module.exports = {
  ApsConfiguration,
  APS_CONFIGURATION_PROJECTIONS,
};
