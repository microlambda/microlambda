export interface ISecretConfig {
  name: string;
  value: string;
  env: string;
  inject?: 'arn' | 'value';
  description?: string;
  kmsKeyId?: string;
}
