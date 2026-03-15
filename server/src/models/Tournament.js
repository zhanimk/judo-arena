const mongoose = require('mongoose');

const TOURNAMENT_STATUSES = [
  'DRAFT',
  'REGISTRATION_OPEN',
  'REGISTRATION_CLOSED',
  'BRACKETS_GENERATED',
  'IN_PROGRESS',
  'PAUSED',
  'COMPLETED',
  'ARCHIVED',
  'CANCELLED',
];

const TOURNAMENT_VISIBILITIES = ['PUBLIC', 'PRIVATE'];
const GENDERS = ['male', 'female'];

const categorySchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    gender: {
      type: String,
      enum: GENDERS,
      required: true,
    },
    ageCategory: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    weightCategory: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    minAge: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    maxAge: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    minWeight: {
      type: Number,
      default: null,
      min: 0,
      max: 500,
    },
    maxWeight: {
      type: Number,
      default: null,
      min: 0,
      max: 500,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    categoryKey: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

const tournamentSettingsSchema = new mongoose.Schema(
  {
    bracketFormat: {
      type: String,
      default: 'IJF_REPECHAGE',
      trim: true,
    },
    allowManualCorrections: {
      type: Boolean,
      default: true,
    },
    enableRepechage: {
      type: Boolean,
      default: true,
    },
    enableBronzeMatches: {
      type: Boolean,
      default: true,
    },
  },
  {
    _id: false,
  }
);

const tournamentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200,
    },
    description: {
      type: String,
      default: null,
      maxlength: 5000,
    },
    location: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    address: {
      type: String,
      default: null,
      maxlength: 500,
    },

    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    registrationDeadline: {
      type: Date,
      required: true,
    },

    tatamiCount: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },

    status: {
      type: String,
      enum: TOURNAMENT_STATUSES,
      default: 'DRAFT',
      required: true,
      index: true,
    },

    visibility: {
      type: String,
      enum: TOURNAMENT_VISIBILITIES,
      default: 'PRIVATE',
      required: true,
    },

    isPublished: {
      type: Boolean,
      default: false,
      required: true,
    },

    publishedAt: {
      type: Date,
      default: null,
    },

    categories: {
      type: [categorySchema],
      default: [],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    settings: {
      type: tournamentSettingsSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

tournamentSchema.index({ visibility: 1 });
tournamentSchema.index({ startDate: 1 });
tournamentSchema.index({ registrationDeadline: 1 });

module.exports = mongoose.model('Tournament', tournamentSchema);