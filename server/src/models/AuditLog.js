const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actorRole: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },

    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },

    entityType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    before: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    after: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    reason: {
      type: String,
      default: null,
      maxlength: 2000,
    },

    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);