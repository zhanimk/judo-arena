const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const ROLES = ['ATHLETE', 'COACH', 'JUDGE', 'ADMIN'];
const USER_STATUSES = ['ACTIVE', 'INACTIVE', 'BLOCKED'];
const CLUB_REQUEST_STATUSES = ['NONE', 'PENDING', 'APPROVED', 'REJECTED'];
const GENDERS = ['male', 'female'];

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 255,
    },
    passwordHash: {
      type: String,
      required: true,
      minlength: 20,
    },

    role: {
      type: String,
      enum: ROLES,
      required: true,
    },
    status: {
      type: String,
      enum: USER_STATUSES,
      default: 'ACTIVE',
      required: true,
    },

    dateOfBirth: {
      type: Date,
      default: null,
    },
    gender: {
      type: String,
      enum: GENDERS,
      default: null,
    },
    city: {
      type: String,
      trim: true,
      default: null,
      maxlength: 120,
    },

    weight: {
      type: Number,
      min: 0,
      max: 500,
      default: null,
    },
    rank: {
      type: String,
      trim: true,
      default: null,
      maxlength: 80,
    },

    clubId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Club',
      default: null,
      index: true,
    },
    coachId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    requestedClubId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Club',
      default: null,
      index: true,
    },
    clubRequestStatus: {
      type: String,
      enum: CLUB_REQUEST_STATUSES,
      default: 'NONE',
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

userSchema.index({ role: 1 });

userSchema.methods.comparePassword = async function comparePassword(plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

userSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
