import React, { Component } from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import { TranspilingStatus } from '../../lerna/enums/compilation.status';
import { IPackage } from '../state/store';

export interface IPackageListProps {
  packages: IPackage[];
  selected: string;
}

export class PackagesList extends Component<IPackageListProps> {
  static getCompilationStatus(node: IPackage): string {
    if (!node.enabled) {
      return chalk.grey('[Disabled]');
    }
    // TODO: Transpiled + Type checked in lazy mode
    switch (node.compilationStatus) {
      case TranspilingStatus.TRANSPILED:
        return chalk.green('[Compiled]');
      case TranspilingStatus.TRANSPILING:
        return chalk.cyan('[Compiling]');
      case TranspilingStatus.ERROR_TRANSPILING:
        return chalk.red('[Error compiling]');
      case TranspilingStatus.NOT_TRANSPILED:
        return chalk.grey('[Not compiled]');
    }
  }

  render(): JSX.Element[] {
    return this.props.packages
      ? this.props.packages.map((pkg) => (
          <Box key={pkg.name} flexDirection={'row'} justifyContent={'space-between'}>
            <Text bold={true}>{pkg.name === this.props.selected ? '->' : ''}</Text>
            <Text bold={false}>{pkg.name}</Text>
            <Text> {PackagesList.getCompilationStatus(pkg)}</Text>
          </Box>
        ))
      : [<Text key={'no-packages'}>No shared package</Text>];
  }
}
