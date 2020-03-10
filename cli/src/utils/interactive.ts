import inquirer from 'inquirer';

import { log } from './logger';
import { Service } from '../lerna';

export const interactive = async (services: Service[], message: string): Promise<Service[]> => {
  let chosenServices = [];

  log.debug('Interactive option chosen, prompting user');
  log.info(services.map((service: Service) => service.getName()));

  const choices: { microservices: string[] } = await inquirer.prompt({
    type: 'checkbox',
    name: 'microservices',
    message: message,
    choices: services.map((service: Service) => service.getName()),
  });

  if (choices.microservices.length !== 0) {
    chosenServices = services.filter((s) => choices.microservices.includes(s.getName()));
  } else {
    log.info('No services found, exiting...');
    process.exit(0);
  }

  return chosenServices;
};
