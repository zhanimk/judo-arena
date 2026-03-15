const Joi = require('joi');

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const overrideMatchSchema = Joi.object({

  params: Joi.object({
    id:Joi.string().pattern(objectIdPattern).required()
  }),

  body:Joi.object({

    winnerSlot:Joi.string().valid("A","B").required(),

    scoreA:Joi.number().optional(),
    scoreB:Joi.number().optional(),

    penaltiesA:Joi.number().optional(),
    penaltiesB:Joi.number().optional(),

    reason:Joi.string().max(500).optional()

  })

});

module.exports = {
  overrideMatchSchema
};