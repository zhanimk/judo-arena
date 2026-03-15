const mongoose = require('mongoose');

const APPLICATION_STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'];

const applicationSchema = new mongoose.Schema(
  {
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true,
      index: true,
    },
    clubId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Club',
      required: true,
      index: true,
    },
    coachId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    athletes: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
      validate: {
        validator(arr) {
          return new Set(arr.map(String)).size === arr.length;
        },
        message: 'Athletes array contains duplicate user IDs.',
      },
    },

    documents: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'File' }],
      default: [],
    },

    status: {
      type: String,
      enum: APPLICATION_STATUSES,
      default: 'DRAFT',
      required: true,
      index: true,
    },

    reviewComment: {
      type: String,
      default: null,
      maxlength: 2000,
    },

    submittedAt: {
      type: Date,
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

applicationSchema.index({ tournamentId: 1, clubId: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);
