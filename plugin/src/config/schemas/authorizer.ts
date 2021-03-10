import joi from "joi";
import { authorizerConfigCommon } from "./authorizer-common";

export const authorizerConfig = joi.alternatives(
  authorizerConfigCommon.keys({
    name: joi.string().required(),
  }),
  authorizerConfigCommon.keys({
    arn: joi.string().required(),
  })
);
