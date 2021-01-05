import { Logger, RecompilationScheduler } from '@microlambda/core';

// TODO: Fix this properly
export const logs = async (cmd: { S: string }, logger: Logger, scheduler: RecompilationScheduler): Promise<void> => {
  logger.log('log').debug({ cmd, scheduler });
  /*const { projectRoot, config } = await init(logger, scheduler);
  let services: Service[] = [];
  logger.log('logs').debug(config);

  if (!cmd.S) {
    const graph = await getGraphFromYarnProject(projectRoot, scheduler, config, logger, 3001);

    await graph.bootstrap().catch((e) => {
      logger.log('logs').error(e);
      logger
        .log('logs')
        .error(
          'Error installing microservices dependencies. Run in verbose mode (export MILA_DEBUG=*) for more infos.',
        );
      process.exit(1);
    });

    const enabledServices = graph.getServices().filter((s) => !config.noStart.includes(s.getName()));

    await interactive(
      enabledServices,
      'Please select the microservices for which you want to see the logs',
      logger,
    ).then((s: Service[]) => (services = s));

    // Here we need something more consistent to remove the first part of the service name (Depending on the variety of prefix name)
    const servicesName = services.map((s) => s.getName().replace('@project/', ''));

    servicesName.forEach((name: string) => tailLogs(name, projectRoot, logger));
  } else {
    tailLogs(cmd.S, projectRoot, logger);
  }*/
};
