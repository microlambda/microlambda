import React, { Component } from 'react';
import { Box, Text } from 'ink';
import { ServiceStatus } from '../../lerna/enums/service.status';
import chalk from 'chalk';
import { IService } from '../state/store';
import { PackagesList } from './packages-list';

export interface IServiceListProps {
  services: IService[];
  selected: string;
}

export class ServicesList extends Component<IServiceListProps> {
  private static _formatService(service: IService): string {
    const getStatus = (): string => {
      if (!service.enabled) {
        return '';
      }
      switch (service.status) {
        case ServiceStatus.CRASHED:
          return chalk.bgRed('[Crashed]');
        case ServiceStatus.RUNNING:
          return chalk.green(`[Running on :${service.port}]`);
        case ServiceStatus.STARTING:
          return chalk.cyan(`[Starting on :${service.port}]`);
        case ServiceStatus.STOPPED:
          return chalk.red('[Stopped]');
        case ServiceStatus.STOPPING:
          return chalk.yellow('[Stopping]');
      }
    };
    return `${PackagesList.getCompilationStatus(service)} ${getStatus()}`;
  }

  render(): JSX.Element[] {
    return this.props.services
      ? this.props.services.map((service) => (
          <Box key={service.name} flexDirection={'row'} justifyContent={'space-between'}>
            <Text bold={true}>{service.name === this.props.selected ? '->' : ''}</Text>
            <Text bold={true}>{service.name}</Text>
            <Text> {ServicesList._formatService(service)}</Text>
          </Box>
        ))
      : [<Text key={'no-service'}>No services</Text>];
  }
}
