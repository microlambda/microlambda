import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

// This is willingly duplicated from @microlambda/aws to keep @microlambda/handling package as small as possible
const getSecret = async (name: string, version?: string): Promise<string | undefined> => {
  const secretManager = new SecretsManagerClient({
    region: process.env.AWS_REGION,
  });
  const getValue = new GetSecretValueCommand({
    SecretId: name,
    VersionId: version,
  });
  return (await secretManager.send(getValue)).SecretString;
}

const getParameterValue = async (
  name: string,
): Promise<string | undefined> => {
  const ssm = new SSMClient({
    region: process.env.AWS_REGION,
  });
  const getValue = new GetParameterCommand({
    Name: name,
  });
  return (await ssm.send(getValue)).Parameter?.Value;
};


export const injectSecrets = async (): Promise<void> => {
  const resolveSpecialEnvVars$: Array<Promise<void>> = [];
  for (const key of Object.keys(process.env)) {
    const isSsmParameter = process.env[key]?.match(/^\$\{ssm:(.+)}$/);
    const isSecret = process.env[key]?.match(/^\$\{secret:(.+)}$/);
    if (isSecret) {
      let version: string | undefined;
      let name = isSecret[1];
      const hasVersion = isSecret[1].match(/^(.+):(.+)$/);
      if (hasVersion) {
        name = hasVersion[1];
        version = hasVersion[2];
      }
      resolveSpecialEnvVars$.push(getSecret(name, version)
        .then((value) => {
          process.env[key] = value;
        })
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.warn('Error injecting secret', isSecret[1], e);
          delete process.env[key];
        }));
    } else if (isSsmParameter) {
      resolveSpecialEnvVars$.push(getParameterValue(isSsmParameter[1])
        .then((value) => {
          process.env[key] = value;
        })
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.warn('Error injecting secret', isSsmParameter[1], e);
          delete process.env[key];
        }));
    }
  }
  await Promise.all(resolveSpecialEnvVars$);
};
