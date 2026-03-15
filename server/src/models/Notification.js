const mongoose = require('mongoose');

const NOTIFICATION_TYPES = [
  'APPLICATION_APPROVED',
  'APPLICATION_REJECTED',

  'MATCH_ASSIGNED',
  'MATCH_CALLED',

  'MATCH_STARTED',
  'MATCH_COMPLETED',

  'MATCH_RESULT_CHANGED',

  'TOURNAMENT_STARTED',
  'TOURNAMENT_PAUSED',
  'TOURNAMENT_COMPLETED',

  'SYSTEM'
];

const notificationSchema = new mongoose.Schema({

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  type: {
    type: String,
    enum: NOTIFICATION_TYPES,
    required: true
  },

  title: {
    type: String,
    required: true,
    maxlength: 200
  },

  message: {
    type: String,
    required: true,
    maxlength: 2000
  },

  entityType: {
    type: String,
    default: null
  },

  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },

  isRead: {
    type: Boolean,
    default: false,
    index: true
  }

}, {
  timestamps: true
});

notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);