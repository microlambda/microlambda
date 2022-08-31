import { Workspace as CentipodWorkspace } from '@microlambda/runner-core';
import { IBuildOptions } from '../build/options';

export interface IPackageOptions extends IBuildOptions {
  verbose: boolean;
  concurrency: number;
  targets: CentipodWorkspace[];
}
