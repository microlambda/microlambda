export interface IAuthorizerConfig {
  name: string;
  arn: string;
  resultTtlInSeconds: number;
  identitySource: string;
  identityValidationExpression: string;
  type: "token" | "request";
}
