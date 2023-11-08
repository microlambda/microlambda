import { resolveProjectRoot } from '@microlambda/utils';
import { readJSONSync, writeJSONSync } from 'fs-extra'
import { join } from 'path';
import { getDependenciesGraph } from "@microlambda/cli/dist/utils/parse-deps-graph";

(async () => {
  try {
    const version = process.argv[2];
    const project =  await getDependenciesGraph(resolveProjectRoot());
    project.workspaces.forEach((w) => {
      const manifest = readJSONSync(join(w.root, 'package.json'));
      manifest.version = version;
      writeJSONSync(join(w.root, 'package.json'), manifest, { spaces: 2 });
    })
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
