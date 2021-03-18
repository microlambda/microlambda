import joi from "joi";

const removeWhen = joi.object().keys({
  keep: joi.string().required(),
  when: joi.string().required(),
});

const keepWhen = joi.object().keys({
  remove: joi.string().required(),
  when: joi.string().required(),
});

export const conditionsSchema = joi.array().items(
  joi.alternatives(
    removeWhen.keys({
      eq: joi.string().required(),
    }),
    removeWhen.keys({
      neq: joi.string().required(),
    }),
    keepWhen.keys({
      eq: joi.string().required(),
    }),
    keepWhen.keys({
      neq: joi.string().required(),
    })
  )
);
