import { Logger } from '../utils/logger';
import {
  RecompilationScheduler,
} from '../utils/scheduler';
import { beforePackage, IPackageCmd, packageService } from './package';
import { ConfigReader } from '../config/read-config';
import { CertificateEventType, CertificateManager, ICertificateEvent } from '../deploy/utils/generate-certificates';
import Spinnies from "spinnies";
import chalk from 'chalk';

interface IDeployCmd extends IPackageCmd {
  stage: string;
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
  if (cmd.prompt) {
    // TODO: Prompt user to have confirmation
  }
  // TODO: Validate stage
  const { concurrency, graph, service} = await beforePackage(cmd, scheduler, logger);
  if (cmd.package) {
    console.info('\nPackaging services\n');
    try {
      await packageService(scheduler, concurrency, cmd.S ? service : graph)
    } catch (e) {
      process.exit(1);
    }
  }

  let needActions: boolean;
  let certificateManager: CertificateManager;

  try {
    const config = new ConfigReader(logger);
    config.readConfig();
    const services = cmd.S ? [service] : graph.getServices();
    certificateManager = new CertificateManager(logger, services, config);
    needActions = await certificateManager.prepareCertificatesRequests(cmd.stage);
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
    // run sls create domain
    // run sls deploy
    // create DNS records
  }

  console.info('\nDeploying services\n');
}
