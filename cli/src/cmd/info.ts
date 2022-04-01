import {Project} from "@microlambda/core";
import {resolveProjectRoot, Workspace} from "@centipod/core";
import chalk from 'chalk';

const printTree = (wks: Workspace) => {
  const printDeps = (_wks: Workspace, depth = 0) => {
    for (const dep of _wks.dependencies()) {
      console.info('   '.repeat(depth), chalk.grey(depth ? '|__' : ''), dep.name);
      printDeps(dep, depth + 1);
    }
  }
  printDeps(wks);
}

interface IInfosOptions {
  s: string;
  roots: boolean;
  leaves: boolean;
  graph: boolean;
}

export const info = async (cmd: IInfosOptions): Promise<void> => {
  const projectRoot = resolveProjectRoot();
  const project =  await Project.loadProject(projectRoot);
  if (!cmd.s) {
    console.log('\n');
    console.log(chalk.magenta.bold(project.name));
    console.log(chalk.grey('Project root: ' + projectRoot));
    if (cmd.graph) {
      for (const root of project.roots.values()) {
        printTree(root);
      }
    } else if (cmd.roots) {
      const roots: Workspace[] = []
      for (const root of project.roots.values()) roots.push(root)
      console.log(chalk.cyan(`\nRoots (${roots.length})\n`));
      console.log(roots.map((s) => `- ${s.name}`).join('\n'));
    } else if (cmd.leaves) {
      const leaves: Workspace[] = []
      for (const root of project.leaves.values()) leaves.push(root)
      console.log(chalk.cyan(`\nLeaves (${leaves.length})\n`));
      console.log(leaves.map((s) => `- ${s.name}`).join('\n'));
    } else {
      console.log(chalk.cyan(`\nPackages (${project.packages.size})\n`));
      console.log(Array.from(project.packages.values()).map((pkg) => `- ${pkg.name}`).join('\n'));
      console.log(chalk.cyan(`\nServices (${project.services.size})\n`));
      console.log(Array.from(project.services.values()).map((s) => `- ${s.name}`).join('\n'));
    }
  } else {
    const wks = project.workspaces.get(cmd.s);
    if (wks) {
      console.log('\n');
      console.log(chalk.magenta.bold(wks.name));
      console.log(chalk.cyan('Dependencies\n'));
      if (cmd.graph) {
        printTree(wks);
      } else {
        console.log(Array.from(wks.descendants.values()).map((s) => `- ${s.name}`).join('\n'));
      }
      console.log(chalk.cyan('\nWorkspaces depending on\n'));
      if (!wks.ancestors.size) {
        console.info('No workspace depending on', wks.name);
      }
      for (const dep of wks.ancestors.values()) {
        console.log(`- ${dep.name}`);
      }
    } else {
      console.error(chalk.red('Unknown workspace ' + cmd.s));
      process.exit(1);
    }
  }
};
