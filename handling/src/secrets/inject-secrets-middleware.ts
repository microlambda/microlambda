import { aws } from '@microlambda/aws';

export const injectSecrets = async (): Promise<void> => {
  const fetchSecretRequests: Array<Promise<void>> = [];
  for (const key of Object.keys(process.env)) {
    const isSecret = process.env[key]?.match(/^\${secret:(arn:aws:secretsmanager:([a-z0-9-]+):[0-9]{12}:secret:\/(.+))}$/);
    if (isSecret) {
      const [secret, arn, region] = isSecret;
      fetchSecretRequests.push(aws.secretsManager.getSecretValue(region, arn)
        .then((value) => {
          process.env[key] = value;
        })
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.warn('Error injecting secret', secret, e);
          delete process.env[key];
        }));
    }
  }
  await Promise.all(fetchSecretRequests);
};
