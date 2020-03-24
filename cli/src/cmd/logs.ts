import { getProjectRoot } from '../utils/get-project-root';
import { loadConfig } from '../config/load-config';
import { Service } from '../lerna';
import { log } from '../utils/logger';
import { getLernaGraph } from '../utils/get-lerna-graph';
import { interactive } from '../utils/interactive';
import { tailLogs } from '../utils/logs';

export const logs = async (cmd: { S: string }): Promise<void> => {
  const projectRoot = getProjectRoot();
  const config = loadConfig();
  let services: Service[] = [];
  log('logs').debug(config);

  if (!cmd.S) {
    const graph = await getLernaGraph(projectRoot, config, 3001);

    await graph.bootstrap().catch((e) => {
      log('logs').error(e);
      log('logs').error(
        'Error installing microservices dependencies. Run in verbose mode (export MILA_DEBUG=*) for more infos.',
      );
      process.exit(1);
    });

    const enabledServices = graph.getServices().filter((s) => !config.noStart.includes(s.getName()));

    await interactive(enabledServices, 'Please select the microservices for which you want to see the logs').then(
      (s: Service[]) => (services = s),
    );

    // Here we need something more consistent to remove the first part of the service name (Depending on the variety of prefix name)
    const servicesName = services.map((s) => s.getName().replace('@project/', ''));

    servicesName.forEach((name: string) => tailLogs(name, projectRoot));
  } else {
    tailLogs(cmd.S, projectRoot);
  }
};
