import Table from 'cli-table3';
import { IEnvironment, IServiceInstance, State } from '@microlambda/remote-state';
import { logger } from '../logger';
import chalk from 'chalk';
import { Workspace } from '@microlambda/core';

export type RemoveOperations = Map<string, Map<string, IServiceInstance>>;

export const resolveRemoveOperations = async (
  env: IEnvironment,
  state: State,
  services: Workspace[] | undefined,
  releaseLock: (msg?: string) => Promise<void>,
  onNothing?: () => void | Promise<void>,
): Promise<RemoveOperations> => {
  const servicesInstances = await state.listServices(env.name);

  const allRegions = [...env.regions];

  const table = new Table({
    head: ['Service', ...allRegions],
    style: {
      head: ['cyan'],
    },
  });

  const deployedServicesInstancesGroupedByName = new Map<string, Map<string, IServiceInstance>>();

  for (const servicesInstance of servicesInstances) {
    if (services && !services.some((s) => s.name === servicesInstance.name)) {
      continue;
    }
    const deployedServicesInstances = deployedServicesInstancesGroupedByName.get(servicesInstance.name);
    if (deployedServicesInstances) {
      deployedServicesInstances.set(servicesInstance.region, servicesInstance);
    } else {
      deployedServicesInstancesGroupedByName.set(
        servicesInstance.name,
        new Map([[servicesInstance.region, servicesInstance]]),
      );
    }
  }

  if (deployedServicesInstancesGroupedByName.size < 1) {
    await releaseLock();
    logger.lf();
    logger.success('Nothing to do');
    if (onNothing) {
      await onNothing();
    }
    process.exit(0);
  }

  for (const [serviceName, instancesByRegion] of deployedServicesInstancesGroupedByName.entries()) {
    const row = [chalk.bold(serviceName)];
    for (const region of env.regions) {
      const serviceInstance = instancesByRegion.get(region);
      row.push(
        serviceInstance
          ? `${chalk.bold.red('destroy')} (${serviceInstance.sha1.slice(0, 6)})`
          : chalk.grey('not deployed'),
      );
    }
    table.push(row);
  }

  // eslint-disable-next-line no-console
  console.log(table.toString());
  return deployedServicesInstancesGroupedByName;
};
