import { Workspace } from '@microlambda/runner-core';
import { existsSync, rmdirSync } from 'fs';
import { join } from 'path';

export const removeDotServerless = async (service: Workspace | undefined) => {
  if (!service) {
    throw new Error('Assertion failed: current service should have been resolved');
  }
  const serverlessFolder = join(service.root, '.serverless');
  if (existsSync(serverlessFolder)) {
    rmdirSync(serverlessFolder, {recursive: true});
  }
}
