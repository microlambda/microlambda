import React, { Component } from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import { CompilationStatus } from '../../lerna/enums/compilation.status';
import { IPackage } from '../state/store';

export class PackagesList extends Component<{ packages: IPackage[] }> {
  static getCompilationStatus(node: IPackage): string {
    if (!node.enabled) {
      return chalk.grey('[Disabled]');
    }
    // TODO: Transpiled + Type checked in lazy mode
    switch (node.compilationStatus) {
      case CompilationStatus.COMPILED:
        return chalk.green('[Compiled]');
      case CompilationStatus.COMPILING:
        return chalk.cyan('[Compiling]');
      case CompilationStatus.ERROR_COMPILING:
        return chalk.red('[Error compiling]');
      case CompilationStatus.NOT_COMPILED:
        return chalk.grey('[Not compiled]');
    }
  }

  render(): JSX.Element[] {
    return this.props.packages
      ? this.props.packages.map((pkg) => (
          <Box key={pkg.name} flexDirection={'row'} justifyContent={'space-between'}>
            <Text bold={true}>{pkg.name}</Text>
            <Text> {PackagesList.getCompilationStatus(pkg)}</Text>
          </Box>
        ))
      : [<Text key={'no-packages'}>No shared package</Text>];
  }
}
