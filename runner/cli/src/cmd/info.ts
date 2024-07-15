/* eslint-disable no-console */
import {resolveProjectRoot} from "@microlambda/utils";
import { existsSync } from 'fs';
import { join } from 'path';
import {Project} from "@microlambda/runner-core";
import chalk from "chalk";

export const info = async (): Promise<void> => {
  const projectRoot = resolveProjectRoot();
  let packageManager = '';
  if (existsSync(join(projectRoot, 'yarn.lock'))) {
    packageManager = 'yarn';
  }
  if (existsSync(join(projectRoot, 'pnpm-lock.yaml')) || existsSync(join(projectRoot, 'pnpm-workspace.yaml'))) {
    packageManager = 'pnpm';
  }
  console.info(chalk.grey('Package manager:'), chalk.bold.cyan(packageManager));
  console.info(chalk.grey('Project root:'), chalk.cyan(projectRoot));
  console.info(chalk.grey('Workspaces:'))
  const project = await Project.loadProject(projectRoot);
  for (const workspace of project.workspaces.keys()) {
    console.info(chalk.grey('--'), workspace);
  }
}
