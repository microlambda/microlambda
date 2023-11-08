import { Project } from '@microlambda/core';
import { Workspace } from '@microlambda/runner-core';
import chalk from 'chalk';
import { resolveProjectRoot } from '@microlambda/utils';
import { logger } from '../utils/logger';

const printTree = (wks: Workspace): void => {
  const printDeps = (_wks: Workspace, depth = 0): void => {
    for (const dep of _wks.dependencies()) {
      logger.info('   '.repeat(depth), chalk.grey(depth ? '|__' : ''), dep.name);
      printDeps(dep, depth + 1);
    }
  };
  printDeps(wks);
};

interface IInfosOptions {
  s: string;
  roots: boolean;
  leaves: boolean;
  graph: boolean;
}

export const info = async (cmd: IInfosOptions): Promise<void> => {
  const projectRoot = resolveProjectRoot();
  const project = await Project.loadProject(projectRoot);
  if (!cmd.s) {
    logger.info('\n');
    logger.info(chalk.magenta.bold(project.name));
    logger.info(chalk.grey('Project root: ' + projectRoot));
    if (cmd.graph) {
      for (const root of project.roots.values()) {
        printTree(root);
      }
    } else if (cmd.roots) {
      const roots: Workspace[] = [];
      for (const root of project.roots.values()) roots.push(root);
      logger.info(chalk.cyan(`\nRoots (${roots.length})\n`));
      logger.info(roots.map((s) => `- ${s.name}`).join('\n'));
    } else if (cmd.leaves) {
      const leaves: Workspace[] = [];
      for (const root of project.leaves.values()) leaves.push(root);
      logger.info(chalk.cyan(`\nLeaves (${leaves.length})\n`));
      logger.info(leaves.map((s) => `- ${s.name}`).join('\n'));
    } else {
      logger.info(chalk.cyan(`\nPackages (${project.packages.size})\n`));
      logger.info(
        Array.from(project.packages.values())
          .map((pkg) => `- ${pkg.name}`)
          .join('\n'),
      );
      logger.info(chalk.cyan(`\nServices (${project.services.size})\n`));
      logger.info(
        Array.from(project.services.values())
          .map((s) => `- ${s.name}`)
          .join('\n'),
      );
    }
  } else {
    const wks = project.workspaces.get(cmd.s);
    if (wks) {
      logger.info('\n');
      logger.info(chalk.magenta.bold(wks.name));
      logger.info(chalk.cyan('Dependencies\n'));
      if (cmd.graph) {
        printTree(wks);
      } else {
        logger.info(
          Array.from(wks.descendants.values())
            .map((s) => `- ${s.name}`)
            .join('\n'),
        );
      }
      logger.info(chalk.cyan('\nWorkspaces depending on\n'));
      if (!wks.ancestors.size) {
        logger.info('No workspace depending on', wks.name);
      }
      for (const dep of wks.ancestors.values()) {
        logger.info(`- ${dep.name}`);
      }
    } else {
      logger.error(chalk.red('Unknown workspace ' + cmd.s));
      process.exit(1);
    }
  }
};
