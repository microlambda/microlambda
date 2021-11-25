import { getName, getTopologicallySortedWorkspaces, getYarnProject } from '@microlambda/core';
import { commandSync } from 'execa';
import { join } from 'path';
import { readJSONSync } from 'fs-extra';

(async () => {
  try {
    // Foreach workspace topologically sorted
    const project = await getYarnProject(join(__dirname, '..'));
    const workspaces = getTopologicallySortedWorkspaces(project);
    for (const workspace of workspaces) {
      // Check latest version on npm
      console.info('-------------------------------------------------------------------')
      console.info('Analyzing workspace', getName(workspace), workspace.manifest.version);
      const isPrivate = readJSONSync(join(workspace.cwd, 'package.json')).private === true;
      if (isPrivate) {
        console.info('Workspace is private, skipping', getName(workspace));
        continue;
      }
      let rawOutput: string;
      try {
        rawOutput = commandSync(`npm view ${getName(workspace)} --json`).stdout.toString();
      } catch (e: any) {
        rawOutput = e.stdout.toString();
      }
      const npmOutput = JSON.parse(rawOutput);
      const isPublished = npmOutput.error?.code !== 'E404';
      if (!isPublished) {
        console.info(getName(workspace), 'First publication !');
      }
      const latest = isPublished ? npmOutput['dist-tags'].latest : null;
      console.info('Latest version on npm registry', latest);
      // If current version > latest: publish
      if (!isPublished || latest !== workspace.manifest.version) {
        console.info('Publishing', getName(workspace), '@', workspace.manifest.version);
        commandSync(`yarn workspace ${getName(workspace)} npm publish --access public`, { stdio: 'inherit' });
      } else {
        console.info('Skipping', getName(workspace), '@', workspace.manifest.version);
      }
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
