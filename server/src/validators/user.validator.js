const Joi = require('joi');

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const listUsersSchema = Joi.object({
  query: Joi.object({
    role: Joi.string().valid('ATHLETE', 'COACH', 'JUDGE', 'ADMIN').optional(),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'BLOCKED').optional(),
    search: Joi.string().trim().max(120).optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  }).optional(),
  params: Joi.object({}).optional(),
  body: Joi.object({}).optional(),
});

const getUserByIdSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().pattern(objectIdPattern).required(),
  }),
  body: Joi.object({}).optional(),
  query: Joi.object({}).optional(),
});

const updateMyProfileSchema = Joi.object({
  body: Joi.object({
    fullName: Joi.string().min(2).max(120).optional(),

    gender: Joi.string()
      .valid('male', 'female')
      .allow(null)
      .optional(),

    city: Joi.string().max(120).allow(null, '').optional(),

    dateOfBirth: Joi.date().allow(null).optional(),

    weight: Joi.number().min(0).max(500).allow(null).optional(),

    rank: Joi.string().max(80).allow(null, '').optional(),
  }).min(1),
  params: Joi.object({}).optional(),
  query: Joi.object({}).optional(),
});

const updateUserStatusSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().pattern(objectIdPattern).required(),
  }),
  body: Joi.object({
    status: Joi.string()
      .valid('ACTIVE', 'INACTIVE', 'BLOCKED')
      .required(),
  }),
  query: Joi.object({}).optional(),
});

module.exports = {
  listUsersSchema,
  getUserByIdSchema,
  updateMyProfileSchema,
  updateUserStatusSchema,
};
