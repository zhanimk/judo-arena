const Joi = require('joi');

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const categorySchema = Joi.object({
  id: Joi.string().required(),
  label: Joi.string().max(120).required(),
  gender: Joi.string().valid('male', 'female').required(),
  ageCategory: Joi.string().max(80).required(),
  weightCategory: Joi.string().max(80).required(),
  minAge: Joi.number().min(0).max(100).allow(null).optional(),
  maxAge: Joi.number().min(0).max(100).allow(null).optional(),
  minWeight: Joi.number().min(0).max(500).allow(null).optional(),
  maxWeight: Joi.number().min(0).max(500).allow(null).optional(),
  sortOrder: Joi.number().optional(),
  categoryKey: Joi.string().required(),
});

const createTournamentSchema = Joi.object({
  body: Joi.object({
    title: Joi.string().min(2).max(200).required(),
    description: Joi.string().max(5000).allow(null, '').optional(),
    location: Joi.string().min(2).max(255).required(),
    address: Joi.string().max(500).allow(null, '').optional(),
    startDate: Joi.date().required(),
    endDate: Joi.date().required(),
    registrationDeadline: Joi.date().required(),
    tatamiCount: Joi.number().integer().min(1).max(100).required(),
    status: Joi.string()
      .valid(
        'DRAFT',
        'REGISTRATION_OPEN',
        'REGISTRATION_CLOSED',
        'BRACKETS_GENERATED',
        'IN_PROGRESS',
        'PAUSED',
        'COMPLETED',
        'ARCHIVED',
        'CANCELLED'
      )
      .optional(),
    visibility: Joi.string().valid('PUBLIC', 'PRIVATE').optional(),
    isPublished: Joi.boolean().optional(),
    categories: Joi.array().items(categorySchema).optional(),
    settings: Joi.object({
      bracketFormat: Joi.string().max(80).optional(),
      allowManualCorrections: Joi.boolean().optional(),
      enableRepechage: Joi.boolean().optional(),
      enableBronzeMatches: Joi.boolean().optional(),
    }).optional(),
  }),
  params: Joi.object({}).optional(),
  query: Joi.object({}).optional(),
});

const updateTournamentSchema = Joi.object({
  body: Joi.object({
    title: Joi.string().min(2).max(200).optional(),
    description: Joi.string().max(5000).allow(null, '').optional(),
    location: Joi.string().min(2).max(255).optional(),
    address: Joi.string().max(500).allow(null, '').optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    registrationDeadline: Joi.date().optional(),
    tatamiCount: Joi.number().integer().min(1).max(100).optional(),
    visibility: Joi.string().valid('PUBLIC', 'PRIVATE').optional(),
    categories: Joi.array().items(categorySchema).optional(),
    settings: Joi.object({
      bracketFormat: Joi.string().max(80).optional(),
      allowManualCorrections: Joi.boolean().optional(),
      enableRepechage: Joi.boolean().optional(),
      enableBronzeMatches: Joi.boolean().optional(),
    }).optional(),
  }).min(1),
  params: Joi.object({
    id: Joi.string().pattern(objectIdPattern).required(),
  }),
  query: Joi.object({}).optional(),
});

const tournamentIdParamSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().pattern(objectIdPattern).required(),
  }),
  body: Joi.object({}).optional(),
  query: Joi.object({}).optional(),
});

const updateTournamentStatusSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().pattern(objectIdPattern).required(),
  }),
  body: Joi.object({
    status: Joi.string()
      .valid(
        'DRAFT',
        'REGISTRATION_OPEN',
        'REGISTRATION_CLOSED',
        'BRACKETS_GENERATED',
        'IN_PROGRESS',
        'PAUSED',
        'COMPLETED',
        'ARCHIVED',
        'CANCELLED'
      )
      .required(),
  }),
  query: Joi.object({}).optional(),
});

const updateTournamentVisibilitySchema = Joi.object({
  params: Joi.object({
    id: Joi.string().pattern(objectIdPattern).required(),
  }),
  body: Joi.object({
    visibility: Joi.string().valid('PUBLIC', 'PRIVATE').required(),
  }),
  query: Joi.object({}).optional(),
});

const updateTournamentCategoriesSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().pattern(objectIdPattern).required(),}),
    body: Joi.object({
      categories: Joi.array().items(categorySchema).required(),
    }),
    query: Joi.object({}).optional(),
  });
  
  module.exports = {
    createTournamentSchema,
    updateTournamentSchema,
    tournamentIdParamSchema,
    updateTournamentStatusSchema,
    updateTournamentVisibilitySchema,
    updateTournamentCategoriesSchema,
  };