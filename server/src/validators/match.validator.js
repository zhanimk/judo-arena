const Joi = require('joi');

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const matchIdParamSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().pattern(objectIdPattern).required(),
  }),
  body: Joi.object({}).optional(),
  query: Joi.object({}).optional(),
});


const tournamentIdParamSchema = Joi.object({
  params: Joi.object({
    tournamentId: Joi.string().pattern(objectIdPattern).required(),
  }),
  body: Joi.object({}).optional(),
  query: Joi.object({}).optional(),
});

const updateScoreSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().pattern(objectIdPattern).required(),
  }),
  body: Joi.object({
    scoreA: Joi.number().min(0).optional(),
    scoreB: Joi.number().min(0).optional(),
  }).min(1),
  query: Joi.object({}).optional(),
});

const updatePenaltiesSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().pattern(objectIdPattern).required(),
  }),
  body: Joi.object({
    penaltiesA: Joi.number().min(0).optional(),
    penaltiesB: Joi.number().min(0).optional(),
  }).min(1),
  query: Joi.object({}).optional(),
});

const finishMatchSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().pattern(objectIdPattern).required(),
  }),
  body: Joi.object({
    winnerSlot: Joi.string().valid('A', 'B').required(),
    scoreA: Joi.number().min(0).optional(),
    scoreB: Joi.number().min(0).optional(),
    penaltiesA: Joi.number().min(0).optional(),
    penaltiesB: Joi.number().min(0).optional(),
  }),
  query: Joi.object({}).optional(),
});

const reopenMatchSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().pattern(objectIdPattern).required(),
  }),
  body: Joi.object({
    reason: Joi.string().max(1000).allow(null, '').optional(),
  }),
  query: Joi.object({}).optional(),
});

module.exports = {
  matchIdParamSchema,
  tournamentIdParamSchema,
  updateScoreSchema,
  updatePenaltiesSchema,
  finishMatchSchema,
  reopenMatchSchema,
};