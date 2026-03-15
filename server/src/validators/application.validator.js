const Joi = require('joi');

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const createApplicationSchema = Joi.object({
  body: Joi.object({
    tournamentId: Joi.string().pattern(objectIdPattern).required(),
    clubId: Joi.string().pattern(objectIdPattern).required(),
    coachId: Joi.string().pattern(objectIdPattern).optional(),
    athletes: Joi.array()
      .items(Joi.string().pattern(objectIdPattern))
      .unique()
      .optional(),
    documents: Joi.array()
      .items(Joi.string().pattern(objectIdPattern))
      .unique()
      .optional(),
  }),
  params: Joi.object({}).optional(),
  query: Joi.object({}).optional(),
});

const updateApplicationSchema = Joi.object({
  body: Joi.object({
    athletes: Joi.array()
      .items(Joi.string().pattern(objectIdPattern))
      .unique()
      .optional(),
    documents: Joi.array()
      .items(Joi.string().pattern(objectIdPattern))
      .unique()
      .optional(),
  }).min(1),
  params: Joi.object({
    id: Joi.string().pattern(objectIdPattern).required(),
  }),
  query: Joi.object({}).optional(),
});

const applicationIdParamSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().pattern(objectIdPattern).required(),
  }),
  body: Joi.object({}).optional(),
  query: Joi.object({}).optional(),
});

const tournamentApplicationsParamSchema = Joi.object({
  params: Joi.object({
    tournamentId: Joi.string().pattern(objectIdPattern).required(),
  }),
  body: Joi.object({}).optional(),
  query: Joi.object({}).optional(),
});

const rejectApplicationSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().pattern(objectIdPattern).required(),
  }),
  body: Joi.object({
    reviewComment: Joi.string().max(2000).allow(null, '').optional(),
  }),
  query: Joi.object({}).optional(),
});

module.exports = {
  createApplicationSchema,
  updateApplicationSchema,
  applicationIdParamSchema,
  tournamentApplicationsParamSchema,
  rejectApplicationSchema,
};