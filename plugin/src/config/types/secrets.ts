export interface ISecretConfig {
  name: string;
  value: string;
  description?: string;
  kmsKeyId?: string;
}
