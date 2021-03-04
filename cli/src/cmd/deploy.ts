/* eslint-disable no-console */
import { beforePackage, IPackageCmd, packageService } from './package';
import Spinnies from 'spinnies';
import chalk from 'chalk';
import { prompt } from 'inquirer';
import { concat, merge, Observable } from 'rxjs';
import {
  CertificateEventType,
  CertificateManager,
  ICertificateEvent,
  RecordsManager,
  ConfigReader,
  RecompilationScheduler,
  Logger,
  Service,
  getAccountIAM,
  backupYaml,
  reformatYaml,
  restoreYaml,
  IConfig,
} from '@microlambda/core';

interface IDeployCmd extends IPackageCmd {
  E: string;
  package: boolean;
  prompt: boolean;
  verbose: boolean;
}

enum IDeployEventType {
  BACKING_UP_YAML,
  REFORMATTING_YAML,
  CREATING_CUSTOM_DOMAIN,
  CREATED_CUSTOM_DOMAIN,
  DEPLOYING,
  DEPLOYED,
  CREATING_RECORDS,
  CREATED_RECORDS,
  RESTORING_YAML,
  RESTORED_YAML,
  SUCCESS,
  FAILURE,
}

interface IDeployEvent {
  region: string;
  type: IDeployEventType;
  service: Service;
  error?: Error;
}

type ErrorType = 'other' | 'reformatting' | 'creatingDomain' | 'deploying' | 'creatingRecords';

export const requestCertificates = (certificateManager: CertificateManager): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const tty = process.stdout.isTTY;
    const spinnies = new Spinnies({
      failColor: 'white',
      succeedColor: 'white',
      spinnerColor: 'cyan',
    });
    const onNext = (evt: ICertificateEvent): void => {
      const key = `${evt.domain}@${evt.region}`;
      switch (evt.type) {
        case CertificateEventType.CREATING: {
          const text = `${chalk.cyan(`[${evt.region}]`)} Creating certificate for ${evt.domain}`;
          if (tty) {
            spinnies.add(key, { text });
          } else {
            console.info(text);
          }
          break;
        }
        case CertificateEventType.ACTIVATING: {
          const text = `${chalk.cyan(`[${evt.region}]`)} Activating certificate for ${evt.domain} ${chalk.gray(
            'Please be patient, this can take up to thirty minutes',
          )}`;
          if (tty) {
            spinnies.update(key, {
              text,
            });
          } else {
            console.info(text);
          }
          break;
        }
        case CertificateEventType.ACTIVATED: {
          const text = `${chalk.cyan(`[${evt.region}]`)} Successfully created certificate for ${evt.domain}`;
          if (tty) {
            spinnies.add(key, {
              text,
            });
          } else {
            console.info(text);
          }
          break;
        }
      }
    };
    const onError = async (evt: { domain: string; region: string; error: Error }): Promise<void> => {
      const key = `${evt.domain}@${evt.region}`;
      const text = `${chalk.cyan(`[${evt.region}]`)} Error creating certificate for ${evt.domain}`;
      if (tty) {
        spinnies.fail(key, { text });
        spinnies.stopAll();
      } else {
        console.info(text);
      }
      return reject(evt.error);
    };
    const onComplete = (): void => {
      return resolve();
    };
    certificateManager.doRequestCertificates().subscribe(onNext, onError, onComplete);
  });
};

export const checkEnv = (config: IConfig, cmd: { E: string | null }, msg: string): void => {
  if (!cmd.E) {
    console.error(chalk.red(msg));
    process.exit(1);
  }
  if (config.stages && !config.stages.includes(cmd.E)) {
    console.error(chalk.red('Target stage is not part of allowed stages.'));
    console.error(chalk.red('Allowed stages are:', config.stages));
    process.exit(1);
  }
};

export const getCurrentUserIAM = async (): Promise<string> => {
  return getAccountIAM().catch((err) => {
    console.error(chalk.red('You are not authenticated to AWS. Please check your keypair or AWS profile.'));
    console.error(chalk.red('Original error: ' + err));
    process.exit(1);
  });
};

export const deploy = async (cmd: IDeployCmd, logger: Logger, scheduler: RecompilationScheduler): Promise<void> => {
  console.info(chalk.underline(chalk.bold('\n▼ Preparing request\n')));
  const log = logger.log('deploy');
  const reader = new ConfigReader(logger);
  const config = reader.readConfig();
  checkEnv(config, cmd, 'You must provide a target stage to deploy services');
  const currentIAM = await getCurrentUserIAM();

  console.info(chalk.underline(chalk.bold('\n▼ Request summary\n')));
  console.info(chalk.bold('The following services will be deployed'));
  console.info('Stage:', cmd.E);
  console.info('Services:', cmd.S != null ? cmd.S : 'all');
  console.info('As:', currentIAM);

  if (cmd.prompt) {
    const answers = await prompt([
      {
        type: 'confirm',
        name: 'ok',
        message: 'Are you sure you want to execute this deployment',
      },
    ]);
    if (!answers.ok) {
      process.exit(0);
    }
  }

  console.info('');
  const { projectRoot, concurrency, graph, service } = await beforePackage(cmd, scheduler, logger);
  reader.validate(graph);

  /*
  FIXME: Should use scheduler, if a service fails to package for instance others should not been impacted
   */

  if (cmd.package) {
    console.info('\n▼ Packaging services\n');
    await packageService(scheduler, concurrency, cmd.S ? (service as Service) : graph).catch((e) => {
      console.error(chalk.red('Error packaging services'));
      console.error(e);
      process.exit(1);
    });
  }

  let needActions: boolean;
  let certificateManager: CertificateManager;
  const services = cmd.S ? [service as Service] : graph.getServices();

  log.info('Resolving certificates to generate');
  try {
    certificateManager = new CertificateManager(logger, services, reader);
    needActions = await certificateManager.prepareCertificatesRequests(cmd.E);
  } catch (e) {
    console.error(chalk.red('Cannot determine certificate to request'));
    console.error(e);
    process.exit(1);
  }

  if (needActions) {
    try {
      console.info('\n▼ Generating certificates\n');
      await requestCertificates(certificateManager);
    } catch (e) {
      console.error(chalk.red('Error generating certificates'));
      console.error(chalk.red(e));
      process.exit(1);
    }
  } else {
    log.info('No certificate to generate');
  }

  const failures: Map<Service, { type: ErrorType; error: Error }> = new Map();

  const deployOne = (service: Service, region: string): Observable<IDeployEvent> => {
    return new Observable<IDeployEvent>((obs) => {
      log.info('Deploying', service.getName());
      obs.next({ service, type: IDeployEventType.BACKING_UP_YAML, region });
      log.info(service.getName(), 'Back-up YAML');
      backupYaml([service]);
      obs.next({ service, type: IDeployEventType.REFORMATTING_YAML, region });
      const failed = (type: ErrorType, e: Error, restore = true): void => {
        log.error(service.getName(), 'Failure', service.getName());
        log.error(type);
        log.error(e);
        failures.set(service, { type, error: e });
        obs.next({ service, type: IDeployEventType.RESTORING_YAML, region });
        if (restore) {
          log.info(service.getName(), 'Restoring YAML');
          restoreYaml([service]);
          log.info(service.getName(), 'YAML restored');
        }
        obs.next({ service, type: IDeployEventType.FAILURE, error: e, region });
      };
      reformatYaml(projectRoot, reader, [service], region, cmd.E)
        .then(async () => {
          try {
            // run sls create domain
            const customDomain = reader.getCustomDomain(service.getName(), cmd.E);
            log.info(service.getName(), 'Custom domain', customDomain);
            if (customDomain) {
              obs.next({ service, type: IDeployEventType.CREATING_CUSTOM_DOMAIN, region });
              try {
                log.info(service.getName(), 'Creating Custom domain', customDomain);
                await service.createCustomDomain(region, cmd.E);
                if (cmd.verbose) {
                  console.log(service.logs.createDomain.join(''));
                }
              } catch (e) {
                failed('creatingDomain', e);
                return obs.complete();
              }
              obs.next({ service, type: IDeployEventType.CREATED_CUSTOM_DOMAIN, region });
            }

            // run sls deploy
            obs.next({ service, type: IDeployEventType.DEPLOYING, region });
            try {
              log.info(service.getName(), 'running npm run deploy');
              await service.deploy(region, cmd.E);
              if (cmd.verbose) {
                console.log(service.logs.deploy.join(''));
              }
            } catch (e) {
              failed('deploying', e);
              return obs.complete();
            }
            obs.next({ service, type: IDeployEventType.DEPLOYED, region });

            obs.next({ service, type: IDeployEventType.RESTORING_YAML, region });
            log.info(service.getName(), 'restoring YAML');
            restoreYaml([service]);
            log.info(service.getName(), 'restored YAML');
            obs.next({ service, type: IDeployEventType.RESTORED_YAML, region });
            obs.next({ service, type: IDeployEventType.CREATING_RECORDS, region });
            try {
              obs.next({ service, type: IDeployEventType.CREATED_RECORDS, region });
              log.info(service.getName(), 'Creating records');
              const recordsManager = new RecordsManager(logger);
              await recordsManager.createRecords(reader, cmd.E, [service]);
              log.info(service.getName(), 'Created records');
            } catch (e) {
              failed('creatingRecords', e, false);
              return obs.complete();
            }
            obs.next({ service, type: IDeployEventType.SUCCESS, region });
            return obs.complete();
          } catch (e) {
            failed('other', e);
            return obs.complete();
          }
        })
        .catch((e) => {
          log.error(service.getName(), 'Error reformatting');
          failed('reformatting', e);
          return obs.complete();
        });
    });
  };

  console.info('\n▼ Deploying services\n');
  let deployments: Observable<IDeployEvent>;

  if (service) {
    log.info('Deploying one service', service.getName());
    const regions = reader.getRegions(service.getName(), cmd.E);
    deployments = concat(...regions.map((region) => deployOne(service as Service, region)));
  } else {
    log.info('Deploying all services');
    const schedule = reader.scheduleDeployments(cmd.E);
    const steps: Array<Observable<IDeployEvent>> = [];
    for (const step of schedule) {
      const toDeploy: Map<Service, Set<string>> = new Map();
      const regions = step.keys();
      for (const region of regions) {
        const stepServices = step.get(region) || [];
        for (const serviceName of stepServices) {
          const stepService = graph.getServices().find((s) => s.getName() === serviceName);
          if (!stepService) {
            throw Error('Unresolved service ' + serviceName);
          }
          const regions = toDeploy.get(stepService);
          if (regions) {
            regions.add(region);
          } else {
            toDeploy.set(stepService, new Set([region]));
          }
        }
      }
      const stepDeployments: Array<Observable<IDeployEvent>> = [];
      for (const [stepService, regions] of toDeploy.entries()) {
        stepDeployments.push(concat(...Array.from(regions).map((region) => deployOne(stepService, region))));
      }
      steps.push(merge(...stepDeployments, concurrency));
    }
    deployments = concat(...steps);
  }

  const tty = process.stdout.isTTY;
  const spinnies = new Spinnies({
    failColor: 'white',
    succeedColor: 'white',
    spinnerColor: 'cyan',
  });

  deployments.subscribe(
    (evt) => {
      switch (evt.type) {
        case IDeployEventType.BACKING_UP_YAML: {
          if (tty) {
            spinnies.add(evt.service.getName(), {
              text: `Deploying ${evt.service.getName()} ${chalk.cyan('Backing-up YAML')} ${chalk.magenta(
                `[${evt.region}]`,
              )}`,
            });
          } else {
            console.info(`${chalk.bold(evt.service.getName())} - Backing-up YAML ${chalk.magenta(`[${evt.region}]`)}`);
          }
          break;
        }
        case IDeployEventType.REFORMATTING_YAML: {
          if (tty) {
            spinnies.update(evt.service.getName(), {
              text: `Deploying ${evt.service.getName()} ${chalk.cyan('Reformatting YAML')} ${chalk.magenta(
                `[${evt.region}]`,
              )}`,
            });
          } else {
            console.info(
              `${chalk.bold(evt.service.getName())} - Reformatting YAML ${chalk.magenta(`[${evt.region}]`)}`,
            );
          }
          break;
        }
        case IDeployEventType.CREATING_CUSTOM_DOMAIN: {
          if (tty) {
            spinnies.update(evt.service.getName(), {
              text: `Deploying ${evt.service.getName()} ${chalk.cyan('Creating custom domain')} ${chalk.magenta(
                `[${evt.region}]`,
              )}`,
            });
          } else {
            console.info(
              `${chalk.bold(evt.service.getName())} - Creating custom domain ${chalk.magenta(`[${evt.region}]`)}`,
            );
          }
          break;
        }
        case IDeployEventType.DEPLOYING: {
          if (tty) {
            spinnies.update(evt.service.getName(), {
              text: `Deploying ${evt.service.getName()} ${chalk.cyan('Updating CloudFormation stack')} ${chalk.magenta(
                `[${evt.region}]`,
              )}`,
            });
          } else {
            console.info(
              `${chalk.bold(evt.service.getName())} - Deploying CloudFormation stack ${chalk.magenta(
                `[${evt.region}]`,
              )}`,
            );
          }
          break;
        }
        case IDeployEventType.RESTORING_YAML: {
          if (tty) {
            spinnies.update(evt.service.getName(), {
              text: `Deploying ${evt.service.getName()} ${chalk.cyan('Restoring YAML')} ${chalk.magenta(
                `[${evt.region}]`,
              )}`,
            });
          } else {
            console.info(`${chalk.bold(evt.service.getName())} - Restoring YAML ${chalk.magenta(`[${evt.region}]`)}`);
          }
          break;
        }
        case IDeployEventType.CREATING_RECORDS: {
          if (tty) {
            spinnies.update(evt.service.getName(), {
              text: `Deploying ${evt.service.getName()} ${chalk.cyan(
                'Creating latency-based DNS records',
              )} ${chalk.magenta(`[${evt.region}]`)}`,
            });
          } else {
            console.info(
              `${chalk.bold(evt.service.getName())} - Creating latency-based DNS records ${chalk.magenta(
                `[${evt.region}]`,
              )}`,
            );
          }
          break;
        }
        case IDeployEventType.SUCCESS: {
          if (tty) {
            spinnies.succeed(evt.service.getName(), {
              text: `Successfully deployed ${evt.service.getName()} ${chalk.magenta(`[${evt.region}]`)}`,
            });
          } else {
            console.info(
              `${chalk.bold(evt.service.getName())} - Successfully deployed ${chalk.magenta(`[${evt.region}]`)}`,
            );
          }
          break;
        }
        case IDeployEventType.FAILURE: {
          if (tty) {
            spinnies.fail(evt.service.getName(), {
              text: `Failed to deploy ${evt.service.getName()} ${chalk.magenta(`[${evt.region}]`)}`,
            });
          } else {
            console.info(
              `${chalk.bold(evt.service.getName())} - ${chalk.bgRed('Failed to deploy !')} ${chalk.magenta(
                `[${evt.region}]`,
              )}`,
            );
          }
          break;
        }
      }
    },
    (err) => {
      console.error(chalk.red('Error deploying services'));
      console.error(err);
      process.exit(1);
    },
    () => {
      log.info('Deployment process completed', failures.values());
      if (failures.size) {
        const getMessage = (type: ErrorType): string => {
          switch (type) {
            case 'reformatting':
              return 'Error reformatting YAML';
            case 'creatingDomain':
              return 'Error creating custom domain';
            case 'deploying':
              return 'Error deploying CloudFormation stack';
            case 'creatingRecords':
              return 'Error creating latency-based DNS records';
            case 'other':
              return 'Unknown error';
          }
        };
        for (const [service, failure] of failures.entries()) {
          console.info(`\n${chalk.bold(service.getName())}`);
          console.error(chalk.red(getMessage(failure.type)));
          if (failure.error) {
            console.error(failure.error);
          }
          if (failure.type === 'creatingDomain') {
            console.error(service.logs.createDomain.join(''));
          } else if (failure.type === 'deploying') {
            console.error(service.logs.deploy.join(''));
          }
        }
        process.exit(1);
      }
      console.info(`Successfully deployed to ${cmd.E} :rocket:`);
      process.exit(0);

      /*
            console.info(chalk.underline(chalk.bold('▼ Execution summary\n')));
      console.info(`Successfully removed ${toRemove.length - failures.size}/${toRemove.length} services`);
      console.info(`Error occurred when removing ${failures.size} services\n`);
      if (failures.size) {
        console.error(chalk.red('Process exited with errors'));
        process.exit(1);
      }
      console.error(chalk.green('Process exited without errors'));
      process.exit(0);
       */
    },
  );
};
