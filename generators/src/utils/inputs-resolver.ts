import { join } from 'path';
import { prompt } from 'inquirer';
import { exists } from './fs-exists';
import { transpileTs } from './transpile';

export const resolveInputs = async (path: string): Promise<Record<string, unknown>> => {
  const inputsPath = join(path, 'inputs.ts');
  if (await exists(inputsPath)) {
    const inputsCompiledPath = await transpileTs(inputsPath);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const questions = require(inputsCompiledPath);
    return prompt(questions.default);
  }
  return {};
};
