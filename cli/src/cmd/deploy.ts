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

interface IDeployCmd extends IPackageCmd {
  E: string;
  package: boolean;
  prompt: boolean;
}

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
      console.error(chalk.red(e));
      process.exit(1);
    }
  }

  console.info('\nDeploying services\n');
  // TODO: If all services, define steps, run deployment on each region
  backupYaml(services);
  try {
    await reformatYaml(projectRoot, config, services, 'eu-west-1', cmd.E);
    restoreYaml(services);
  } catch (e) {
    // run sls create domain
    // run sls deploy
    restoreYaml(services);
    console.error(chalk.red(e));
    process.exit(1);
  }

  // create DNS records
}
