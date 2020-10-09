import { Logger } from '../utils/logger';
import {
  RecompilationScheduler,
} from '../utils/scheduler';
import { beforePackage, IPackageCmd, packageService } from './package';
import { ConfigReader } from '../config/read-config';
import { CertificateEventType, CertificateManager, ICertificateEvent } from '../deploy/utils/generate-certificates';
import Spinnies from "spinnies";
import chalk from 'chalk';
import { prompt } from 'inquirer';
import { getAccountIAM } from '../utils/aws-account';
import { backupYaml, reformatYaml, restoreYaml } from '../utils/yaml';
import { Service } from '../lerna';
import { concat, merge, Observable } from 'rxjs';
import { RecordsManager } from '../deploy/utils/create-cname-records';

interface IDeployCmd extends IPackageCmd {
  E: string;
  package: boolean;
  prompt: boolean;
}

type ErrorType = 'other' | 'reformatting' | 'creatingDomain' | 'deploying' | 'creatingRecords';

export const requestCertificates = (certificateManager: CertificateManager) => {
  return new Promise<void>((resolve, reject) => {
    const spinnies = new Spinnies({
      failColor: 'white',
      succeedColor: 'white',
      spinnerColor: 'cyan',
    });
    const onNext = (evt: ICertificateEvent) => {
      const key = `${evt.domain}@${evt.region}`;
      switch (evt.type) {
        case CertificateEventType.CREATING: {
          spinnies.add(key, { text: `${chalk.cyan(`[${evt.region}]`)} Creating certificate for ${evt.domain}` });
          break;
        }
        case CertificateEventType.ACTIVATING: {
          spinnies.update(key, { text: `${chalk.cyan(`[${evt.region}]`)} Activating certificate for ${evt.domain} ${chalk.gray('Please be patient, this can take up to thirty minutes')}`});
          break;
        }
        case CertificateEventType.ACTIVATED: {
          spinnies.add(key, { text: `${chalk.cyan(`[${evt.region}]`)} Successfully created certificate for ${evt.domain}` });
          break;
        }
      }
    };
    const onError = async (evt: {domain: string, region: string, error: Error}) => {
      const key = `${evt.domain}@${evt.region}`;
      spinnies.fail(key, { text: `${chalk.cyan(`[${evt.region}]`)} Error creating certificate for ${evt.domain}` });
      spinnies.stopAll();
      return reject(evt.error);
    };
    const onComplete = () => {
      return resolve();
    }
    certificateManager.doRequestCertificates().subscribe(onNext, onError, onComplete);
  });
}

export const deploy = async (cmd: IDeployCmd, logger: Logger, scheduler: RecompilationScheduler) => {
  const config = new ConfigReader(logger);
  config.readConfig();
  if (!cmd.E) {
    console.error(chalk.red('You must provide a target stage to deploy services'));
    process.exit(1);
  }
  if (config.config.stages && !config.config.stages.includes(cmd.E)) {
    console.error(chalk.red('Target stage is not part of allowed stages.'));
    console.error(chalk.red('Allowed stages are:', config.config.stages));
    process.exit(1);
  }
  const currentIAM = await getAccountIAM().catch((err) =>{
    console.error(chalk.red('You are not authenticated to AWS. Please check your keypair or AWS profile.'));
    console.error(chalk.red('Original error: ' + err));
    process.exit(1);
  });

  console.info(chalk.bold('\nDeployment information'));
  console.info('Stage:', cmd.E);
  console.info('Services:', cmd.S != null ? cmd.S : 'all');
  console.info('As:', currentIAM);

  if (cmd.prompt) {
    const answers = await prompt([
      {
        type: 'confirm',
        name: 'ok',
        message: 'Are you sure you want to execute this deployment',
      }
    ]);
    if (!answers.ok) {
      process.exit(0);
    }
  }

  console.log('\n');
  const { projectRoot, concurrency, graph, service} = await beforePackage(cmd, scheduler, logger);
  config.validate(graph);
  if (cmd.package) {
    console.info('\nPackaging services\n');
    await packageService(scheduler, concurrency, cmd.S ? service : graph).catch((e) => {
      console.error(chalk.red('Error packaging services'));
      console.error(e);
      process.exit(1);
    });
  }

  let needActions: boolean;
  let certificateManager: CertificateManager;
  const services = cmd.S ? [service] : graph.getServices();

  try {
    certificateManager = new CertificateManager(logger, services, config);
    needActions = await certificateManager.prepareCertificatesRequests(cmd.E);
  } catch (e) {
    console.error(chalk.red('Cannot determine certificate to request'));
    console.error(e);
    process.exit(1);
  }

  if (needActions) {
    try {
      console.info('\nGenerating certificates\n');
      await requestCertificates(certificateManager);
    } catch (e) {
      console.error(chalk.red('Error generating certificates'));
      console.error(chalk.red(e));
      process.exit(1);
    }
  }

  const failures: Map<Service, {type: ErrorType, error: Error}> = new Map();

  const deployOne = (service: Service, region: string): Observable<IDeployEvent> => {
    return new Observable<IDeployEvent>( (obs) => {
      obs.next({service, type: IDeployEventType.BACKING_UP_YAML});
      backupYaml([service]);
      obs.next({service, type: IDeployEventType.REFORMATTING_YAML});
      const failed = (type: ErrorType, e: Error, restore = true) => {
        failures.set(service, {type, error: e});
        obs.next({service, type: IDeployEventType.RESTORING_YAML});
        if (restore) {
          restoreYaml([service]);
        }
        obs.next({service, type: IDeployEventType.FAILURE, error: e});
      }
      reformatYaml(projectRoot, config, [service], region, cmd.E)
        .then(async () => {
          try {
            // run sls create domain
            const customDomain = config.getCustomDomain(service.getName(), cmd.E);
            if (customDomain) {
              obs.next({service, type: IDeployEventType.CREATING_CUSTOM_DOMAIN});
              try {
                await service.createCustomDomain(region, cmd.E);
              } catch (e) {
                failed('creatingDomain', e);
                return obs.complete();
              }
              obs.next({service, type: IDeployEventType.CREATED_CUSTOM_DOMAIN});
            }

            // run sls deploy
            obs.next({service, type: IDeployEventType.DEPLOYING});
            try {
              await service.deploy(region, cmd.E);
            } catch (e) {
              failed('deploying', e);
              return obs.complete();
            }
            obs.next({service, type: IDeployEventType.DEPLOYED});

            obs.next({service, type: IDeployEventType.RESTORING_YAML});
            restoreYaml([service]);
            obs.next({service, type: IDeployEventType.RESTORED_YAML});
            obs.next({service, type: IDeployEventType.CREATING_RECORDS});
            try {
              obs.next({service, type: IDeployEventType.CREATED_RECORDS});
              const recordsManager = new RecordsManager(logger);
              await recordsManager.createRecords(config, cmd.E, [service]);
            } catch (e) {
              failed('creatingRecords', e, false);
              return obs.complete();
            }
            obs.next({service, type: IDeployEventType.SUCCESS});
            return obs.complete();
          } catch (e) {
            failed('other', e);
          }
        })
        .catch((e) => {
          failed('reformatting', e);
        });
    })
  }

  console.info('\nDeploying services\n');
  let deployments: Observable<IDeployEvent>;

  if (cmd.S) {
    const regions = config.getRegions(service.getName(), cmd.E);
    deployments = concat(...regions.map(region => deployOne(service, region)));
  } else {
    const schedule = config.scheduleDeployments(cmd.E);
    let steps: Array<Observable<IDeployEvent>> = [];
    for (const step of schedule) {
      const toDeploy: Map<Service, Set<string>> = new Map();
      const regions = step.keys();
      for (const region of regions) {
        const stepServices = step.get(region);
        for (const serviceName of stepServices) {
          const stepService = graph.getServices().find((s) => s.getName() === serviceName);
          if (!stepService) {
            throw Error('Unresolved service ' + serviceName);
          }
          if (toDeploy.has(stepService)) {
            toDeploy.get(stepService).add(region);
          } else {
            toDeploy.set(stepService, new Set([region]));
          }
        }
      }
      const stepDeployments: Array<Observable<IDeployEvent>> = [];
      for (const [stepService, regions] of toDeploy.entries()) {
        stepDeployments.push(concat(...Array.from(regions).map(region => deployOne(stepService, region))));
      }
      steps.push(merge(...stepDeployments, concurrency));
    }
    deployments = concat(...steps);
  }

  const spinnies = new Spinnies({
    failColor: 'white',
    succeedColor: 'white',
    spinnerColor: 'cyan',
  });

  deployments.subscribe(
    (evt) => {
      switch (evt.type) {
        case IDeployEventType.BACKING_UP_YAML: {
          spinnies.add(evt.service.getName(), { text: `Deploying ${evt.service.getName()} ${chalk.cyan('Backing-up YAML')}` })
          break;
        }
        case IDeployEventType.REFORMATTING_YAML: {
          spinnies.update(evt.service.getName(), { text: `Deploying ${evt.service.getName()} ${chalk.cyan('Reformatting YAML')}` })
          break;
        }
        case IDeployEventType.CREATING_CUSTOM_DOMAIN: {
          spinnies.update(evt.service.getName(), { text: `Deploying ${evt.service.getName()} ${chalk.cyan('Creating custom domain')}` })
          break;
        }
        case IDeployEventType.DEPLOYING: {
          spinnies.update(evt.service.getName(), { text: `Deploying ${evt.service.getName()} ${chalk.cyan('Updating CloudFormation stack')}` })
          break;
        }
        case IDeployEventType.RESTORING_YAML: {
          spinnies.update(evt.service.getName(), { text: `Deploying ${evt.service.getName()} ${chalk.cyan('Restoring YAML')}` })
          break;
        }
        case IDeployEventType.CREATING_RECORDS: {
          spinnies.update(evt.service.getName(), { text: `Deploying ${evt.service.getName()} ${chalk.cyan('Creating latency-based DNS records')}` })
          break;
        }
        case IDeployEventType.SUCCESS: {
          spinnies.succeed(evt.service.getName(), { text: `Successfully deployed ${evt.service.getName()}` })
          break;
        }
        case IDeployEventType.FAILURE: {
          spinnies.fail(evt.service.getName(), { text: `Failed to deploy ${evt.service.getName()}` })
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
      if (failures.size) {
        const getMessage = (type: ErrorType): string => {
          switch(type) {
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
        }
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
    }
  );
}

interface IDeployEvent {
  type: IDeployEventType;
  service: Service;
  error?: Error;
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
