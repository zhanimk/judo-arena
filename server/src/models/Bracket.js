const mongoose = require('mongoose');

const bracketRoundSchema = new mongoose.Schema(
  {
    roundNumber: Number,
    title: String,
    matchIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Match' }],
  },
  { _id: false }
);

const bracketSchema = new mongoose.Schema(
  {
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true,
      index: true,
    },
    categoryKey: {
      type: String,
      required: true,
    },

    format: {
      type: String,
      default: 'IJF_REPECHAGE',
      required: true,
    },

    participantCount: {
      type: Number,
      required: true,
      min: 0,
    },
    bracketSize: {
      type: Number,
      required: true,
      min: 2,
    },

    mainRounds: {
      type: [bracketRoundSchema],
      default: [],
    },

    repechageRounds: {
      type: [bracketRoundSchema],
      default: [],
    },

    bronzeMatchIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Match' }],
      default: [],
    },

    finalMatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
      default: null,
    },

    status: {
      type: String,
      enum: ['DRAFT', 'ACTIVE', 'COMPLETED'],
      default: 'DRAFT',
      required: true,
    },

    generatedAt: {
      type: Date,
      default: null,
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

bracketSchema.index({ tournamentId: 1, categoryKey: 1 }, { unique: true });

module.exports = mongoose.model('Bracket', bracketSchema);