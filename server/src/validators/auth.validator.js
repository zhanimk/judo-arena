const Joi = require('joi');

const registerSchema = Joi.object({
  body: Joi.object({
    fullName: Joi.string().min(2).max(120).required(),

    email: Joi.string().email().required(),

    password: Joi.string().min(6).max(100).required(),

    role: Joi.string()
      .valid('ATHLETE', 'COACH')
      .required(),
  }),
  query: Joi.object({}).optional(),
  params: Joi.object({}).optional(),
});

const loginSchema = Joi.object({
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),
  query: Joi.object({}).optional(),
  params: Joi.object({}).optional(),
});

module.exports = {
  registerSchema,
  loginSchema,
};