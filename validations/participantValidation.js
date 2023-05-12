const Joi = require("joi").extend(require("@joi/date"));

const createParticipant = {
  body: Joi.object().keys({
    email: Joi.string().required().email(),
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    active: Joi.boolean().required(),
    companyName: Joi.string().required(),
    salary: Joi.number().required(),
    currency: Joi.string().valid("USD", "EUR", "GBP", "NOK").required(),
    country: Joi.string().required(),
    city: Joi.string().required(),
    dob: Joi.date().utc().format("YYYY/MM/DD").required(),
  }),
};

module.exports = {
  createParticipant,
};
