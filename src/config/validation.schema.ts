import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'staging')
    .required(),
  PORT: Joi.number().port().required(),
  DATABASE_HOST: Joi.string().required(),
  DATABASE_PORT: Joi.number().port().required(),
  DATABASE_USERNAME: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().required(),
  DATABASE_NAME: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info'),
  LOG_MAX_FILES: Joi.string().default('14d'),
  LOG_MAX_SIZE: Joi.string().default('20m'),
  LOG_TIMEZONE: Joi.string().default('Europe/Rome'),
});
