const Joi = require('joi');

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const tournamentLiveParamSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().pattern(objectIdPattern).required(),
  }),
  body: Joi.object({}).optional(),
  query: Joi.object({}).optional(),
});

module.exports = {
  tournamentLiveParamSchema,
};