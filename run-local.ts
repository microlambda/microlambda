import { command } from 'execa';

(async () => {
  console.info('Running project locally');
  const projects = [
    'centipod/core',
    'centipod/cli',
    'core',
    'cli',
  ];
  await Promise.all(projects.map(async (project) => {
    const cp = command(`${__dirname}/node_modules/.bin/tsc --watch`, { cwd: project, stdio: 'pipe', env: { ...process.env, FORCE_COLOR: '2' } });
    cp.stdout?.on('data', (chunk: Buffer) => {
      const lines = chunk?.toString()?.split('\n') || [];
      while(lines.length > 1) {
        const line = lines.shift()
        console.log(`[${project}]`, line);
      }
    })
    cp.stderr?.on('data', (chunk: Buffer) => {
      const lines = chunk?.toString()?.split('\n') || [];
      while(lines.length > 1) {
        const line = lines.shift()
        console.log(`[${project}]`, line);
      }
    })
    await cp;
  }));
})();
