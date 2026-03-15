const mongoose = require('mongoose');

const MATCH_TYPES = ['MAIN', 'REPECHAGE', 'BRONZE', 'FINAL'];

const MATCH_STATUSES = [
  'PENDING',
  'READY',
  'IN_PROGRESS',
  'COMPLETED',
  'UNDER_REVIEW',
  'REPLAY_REQUIRED',
  'CANCELLED',
];

const SLOT_SOURCE_TYPES = [
  'STATIC_ATHLETE',
  'WINNER_OF_MATCH',
  'LOSER_OF_MATCH',
  'BYE',
  'MANUAL_OVERRIDE',
  'PLACEHOLDER',
];

const SLOT_OUTCOMES = ['WINNER', 'LOSER', 'NONE'];
const TARGET_SLOTS = ['A', 'B'];

const matchSlotSchema = new mongoose.Schema(
  {
    athleteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    sourceType: {
      type: String,
      enum: SLOT_SOURCE_TYPES,
      default: 'PLACEHOLDER',
      required: true,
    },
    sourceMatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
      default: null,
    },
    sourceOutcome: {
      type: String,
      enum: SLOT_OUTCOMES,
      default: 'NONE',
      required: true,
    },
    isBye: {
      type: Boolean,
      default: false,
    },
    displayNameSnapshot: {
      type: String,
      default: null,
      maxlength: 120,
    },
    clubIdSnapshot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Club',
      default: null,
    },
  },
  { _id: false }
);

const matchAdminFlagsSchema = new mongoose.Schema(
  {
    manuallyEdited: {
      type: Boolean,
      default: false,
    },
    underAdminControl: {
      type: Boolean,
      default: false,
    },
    requiresReview: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const matchAuditMetaSchema = new mongoose.Schema(
  {
    lastEditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lastEditReason: {
      type: String,
      default: null,
      maxlength: 1000,
    },
  },
  { _id: false }
);

const matchSchema = new mongoose.Schema(
  {
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true,
      index: true,
    },
    bracketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bracket',
      required: true,
      index: true,
    },
    categoryKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    matchType: {
      type: String,
      enum: MATCH_TYPES,
      required: true,
      index: true,
    },

    roundType: {
      type: String,
      default: null,
      trim: true,
    },
    roundNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    matchNumber: {
      type: Number,
      required: true,
      min: 1,
    },

    slotA: {
      type: matchSlotSchema,
      required: true,
      default: () => ({}),
    },
    slotB: {
      type: matchSlotSchema,
      required: true,
      default: () => ({}),
    },

    winnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    loserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    status: {
      type: String,
      enum: MATCH_STATUSES,
      default: 'PENDING',
      required: true,
      index: true,
    },

    tatamiNumber: {
      type: Number,
      default: null,
      min: 1,
    },
    judgeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    orderNumber: {
      type: Number,
      default: null,
      min: 1,
    },

    scoreA: {
      type: Number,
      default: 0,
      min: 0,
    },
    scoreB: {
      type: Number,
      default: 0,
      min: 0,
    },
    penaltiesA: {
      type: Number,
      default: 0,
      min: 0,
    },
    penaltiesB: {
      type: Number,
      default: 0,
      min: 0,
    },

    winnerTargetMatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
      default: null,
    },
    winnerTargetSlot: {
      type: String,
      enum: TARGET_SLOTS,
      default: null,
    },

    loserTargetMatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
      default: null,
    },
    loserTargetSlot: {
      type: String,
      enum: TARGET_SLOTS,
      default: null,
    },

    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },

    adminFlags: {
      type: matchAdminFlagsSchema,
      default: () => ({}),
    },
    auditMeta: {
      type: matchAuditMetaSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

matchSchema.index({ tournamentId: 1, tatamiNumber: 1, orderNumber: 1 });

module.exports = mongoose.model('Match', matchSchema);
