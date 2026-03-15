const mongoose = require('mongoose');

const ENTITY_TYPES = ['USER', 'CLUB', 'TOURNAMENT', 'APPLICATION', 'BRACKET', 'MATCH'];

const fileSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    storedName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    path: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    relatedEntityType: {
      type: String,
      enum: ENTITY_TYPES,
      required: true,
    },
    relatedEntityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

fileSchema.index({ relatedEntityType: 1, relatedEntityId: 1 });

module.exports = mongoose.model('File', fileSchema);
