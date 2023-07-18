/**
 * Manage secrets by auto-creating and removing AWS Secrets Manager's secrets on stack deploy / remove
 * Aso grant role to decipher to lambdas execution roles
 */
export * from './stack-create-update';
export * from './delete-secrets';
