import { aws } from '@microlambda/aws';
import { Checksums } from '@microlambda/runner-core/lib/checksums';
import { logger } from '../logger';
import chalk from 'chalk';
import { IEnvironment, State } from '@microlambda/remote-state';
import Table from 'cli-table3';
import { Project } from '@microlambda/core';
import { IDeployCmd } from './cmd-options';
import { IRootConfig } from '@microlambda/config';
import { EventsLog } from '@microlambda/logger';
import {EnvsResolver} from "./envs";

export type ActionType = 'first_deploy' | 'redeploy' | 'no_changes' | 'destroy' | 'not_deployed';
export type Operations = Map<string, Map<string, ActionType>>;

export const resolveDeltas = async (
  env: IEnvironment,
  project: Project,
  cmd: IDeployCmd,
  state: State,
  config: IRootConfig,
  eventsLog: EventsLog,
  envs: EnvsResolver,
): Promise<Map<string, Map<string, ActionType>>> => {
  const log = eventsLog.scope('resolve-deltas');
  logger.lf();
  logger.info(chalk.underline(chalk.bold('▼ Resolving deltas')));
  logger.lf();

  // Resolve and print operations to perform
  const graphServices = [...project.services.values()];
  const targets = cmd.s ? graphServices.filter((s) => cmd.s?.split(',').includes(s.name)) : graphServices;
  const operations = new Map<string, Map<string, ActionType>>();
  const defaultRegions = env.regions;

  for (const localService of targets) {
    const serviceOperations = new Map<string, ActionType>();
    const deployedServices = await state.listServiceInstances(env.name, localService.name);
    const targetRegions: string[] = localService.regions ?? defaultRegions;

    for (const targetRegion of targetRegions) {
      if (!localService.hasCommand('deploy')) {
        serviceOperations.set(targetRegion, 'not_deployed');
        continue;
      }
      const deployedRegionalServiceInstance = deployedServices.find((s) => s.region === targetRegion);
      if (!deployedRegionalServiceInstance) {
        serviceOperations.set(targetRegion, 'first_deploy');
      } else {
        try {
          if (cmd.force || cmd.forcePackage || cmd.forceDeploy) {
            serviceOperations.set(targetRegion, 'redeploy');
            continue;
          }
          const rawStoredChecksums = await aws.s3.downloadBuffer(
            deployedRegionalServiceInstance.checksums_buckets,
            deployedRegionalServiceInstance.checksums_key,
            config.defaultRegion,
          );
          const storedChecksums = rawStoredChecksums ? JSON.parse(rawStoredChecksums?.toString('utf-8')) : {};
          const resolvedEnvs = await envs.resolve(targetRegion);
          const resolvedEnv = resolvedEnvs.get(localService.name) ?? { AWS_REGION: targetRegion };
          const currentChecksums = await new Checksums(localService, 'deploy', [], resolvedEnv).calculate();

          if (Checksums.compare(currentChecksums, storedChecksums)) {
            serviceOperations.set(targetRegion, 'no_changes');
          } else {
            serviceOperations.set(targetRegion, 'redeploy');
          }
        } catch (e) {
          logger.warn(
            'Error reading currently deployed checksums for service',
            localService.name,
            'in region',
            targetRegion,
          );
          logger.warn('This service will be thus redeployed even if it is sources could have not been changed.');
          serviceOperations.set(targetRegion, 'redeploy');
        }
      }
    }

    const deployedRegions = deployedServices.map((s) => s.region);
    for (const deployedRegion of deployedRegions) {
      if (!targetRegions.includes(deployedRegion)) {
        serviceOperations.set(deployedRegion, 'destroy');
      }
    }
    operations.set(localService.name, serviceOperations);
  }

  if (!cmd.s) {
    const deployedServices = await state.listServices(env.name);
    for (const deployedService of deployedServices) {
      if (!graphServices.map((s) => s.name).includes(deployedService.name)) {
        const serviceOperations = new Map<string, ActionType>();
        const deployedServicesInstances = await state.listServiceInstances(env.name, deployedService.name);
        for (const deployedServicesInstance of deployedServicesInstances) {
          serviceOperations.set(deployedServicesInstance.region, 'destroy');
        }
        operations.set(deployedService.name, serviceOperations);
      }
    }
  }

  const printType = (type: ActionType): string => {
    switch (type) {
      case 'redeploy':
      case 'first_deploy':
        return chalk.green(type);
      case 'no_changes':
        return chalk.cyan(type);
      case 'not_deployed':
        return chalk.grey(type);
      case 'destroy':
        return chalk.red.bold(type);
    }
  };

  const allRegions = new Set<string>();
  env.regions.forEach((r) => allRegions.add(r));
  operations.forEach((op) => op.forEach((t, r) => allRegions.add(r)));

  const table = new Table({
    head: ['Service', ...allRegions],
    style: {
      head: ['cyan'],
    },
  });

  for (const [serviceName, serviceOperations] of operations.entries()) {
    const row = [chalk.bold(serviceName)];
    for (const region of allRegions) {
      const type = serviceOperations.get(region);
      row.push(type ? printType(type) : printType('not_deployed'));
    }
    table.push(row);
  }
  // eslint-disable-next-line no-console
  console.log(table.toString());
  logger.lf();
  return operations;
};
