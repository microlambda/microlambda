import { IPackagrConfig, ServerlessInstance } from '@microlambda/types'

export const resolveArchitecture = (serverless: ServerlessInstance, config?: IPackagrConfig): 'arm64' | 'x86_64' => {
  if (config?.architecture) {
      return config.architecture;
  }
  const providerArchitecture = serverless.service.provider.architecture;
  const lambdaArchitectures = Object.values(serverless.service.functions).map((f) => f.architecture).filter((arch) => !!arch);
  if (lambdaArchitectures.length && lambdaArchitectures.some((arch) => providerArchitecture !== arch)) {
      throw new Error('Unsupported function-level architecture configuration');
  }
  if (providerArchitecture) {
      return providerArchitecture;
  }
  return 'x86_64';
};
