const Joi = require('joi');

exports.uploadSchema = Joi.object({
  file: Joi.any().required(),
});