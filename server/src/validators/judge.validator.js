const Joi = require('joi');

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const tatamiQueueParamSchema = Joi.object({
  params: Joi.object({
    tatamiNumber: Joi.number().integer().min(1).required(),
  }),
  body: Joi.object({}).optional(),
  query: Joi.object({}).optional(),
});

const judgeMatchIdParamSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().pattern(objectIdPattern).required(),
  }),
  body: Joi.object({}).optional(),
  query: Joi.object({}).optional(),
});

const assignMatchToTatamiSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().pattern(objectIdPattern).required(),
  }),
  body: Joi.object({
    tatamiNumber: Joi.number().integer().min(1).required(),
    orderNumber: Joi.number().integer().min(1).optional(),
    judgeId: Joi.string().pattern(objectIdPattern).allow(null).optional(),
  }),
  query: Joi.object({}).optional(),
});

const reorderTatamiQueueSchema = Joi.object({
  params: Joi.object({
    tournamentId: Joi.string().pattern(objectIdPattern).required(),
    tatamiNumber: Joi.number().integer().min(1).required(),
  }),
  body: Joi.object({
    orderedMatchIds: Joi.array()
      .items(Joi.string().pattern(objectIdPattern))
      .min(1)
      .required(),
  }),
  query: Joi.object({}).optional(),
});

module.exports = {
  tatamiQueueParamSchema,
  judgeMatchIdParamSchema,
  assignMatchToTatamiSchema,
  reorderTatamiQueueSchema,
};