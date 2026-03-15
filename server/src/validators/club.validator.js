const Joi = require('joi');

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const createClubSchema = Joi.object({
  body: Joi.object({
    name: Joi.string().min(2).max(180).required(),
    city: Joi.string().min(2).max(120).required(),
    description: Joi.string().max(2000).allow(null, '').optional(),
    contacts: Joi.string().max(1000).allow(null, '').optional(),
  }),
  params: Joi.object({}).optional(),
  query: Joi.object({}).optional(),
});

const updateClubSchema = Joi.object({
  body: Joi.object({
    name: Joi.string().min(2).max(180).optional(),
    city: Joi.string().min(2).max(120).optional(),
    description: Joi.string().max(2000).allow(null, '').optional(),
    contacts: Joi.string().max(1000).allow(null, '').optional(),
  }).min(1),
  params: Joi.object({
    id: Joi.string().pattern(objectIdPattern).required(),
  }),
  query: Joi.object({}).optional(),
});

const clubIdParamSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().pattern(objectIdPattern).required(),
  }),
  body: Joi.object({}).optional(),
  query: Joi.object({}).optional(),
});

const clubAthleteParamSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().pattern(objectIdPattern).required(),
    athleteId: Joi.string().pattern(objectIdPattern).required(),
  }),
  body: Joi.object({}).optional(),
  query: Joi.object({}).optional(),
});

module.exports = {
  createClubSchema,
  updateClubSchema,
  clubIdParamSchema,
  clubAthleteParamSchema,
};