import React, { Component } from 'react';
import { Text, Box } from 'ink';
import Divider from 'ink-divider';
import { IPackageListProps } from './packages-list';
import { IServiceListProps } from './services-list';
import { IPackage, IService } from '../state/store';

export interface IActionPanelProps extends IPackageListProps, IServiceListProps {}

export class ActionPanel extends Component<IActionPanelProps> {
  render() {
    if (!this.props.selected) {
      return (
        <Box flexDirection={'column'}>
          <Text bold={true}>Commands</Text>
          <Divider />
          <Text>(up/down): select packages and services</Text>
          <Text>(l): show events log</Text>
          <Text>(q): stop all services and quit</Text>
          <Text>(escape): leave services running and only quit</Text>
        </Box>
      );
    }
    const isPackage = this.props.packages.some((p) => p.name === this.props.selected);
    const selectedNode = isPackage
      ? this.props.packages.find((p) => p.name === this.props.selected)
      : this.props.services.find((p) => p.name === this.props.selected);
    if (isPackage) {
      const pkg = selectedNode as IPackage;
      return (
        <Box flexDirection={'column'}>
          <Text bold={true}>{pkg.name}</Text>
          <Divider />
          <Text>version: {pkg.version}</Text>
          <Text>compilation status: {pkg.compilationStatus} </Text>
          <Text>last compilation took: </Text>
          <Text>using typescript version: 3.7.5</Text>
          <Divider />
          <Text>(e): show compilation errors</Text>
          <Text>(b): recompile package</Text>
          <Text>(t): run packages tests</Text>
          <Text>(escape): close menu</Text>
        </Box>
      );
    }
    const service = selectedNode as IService;
    return (
      <Box flexDirection={'column'}>
        <Text bold={true}>{service.name}</Text>
        <Divider />
        <Text>version: {service.version}</Text>
        <Text>allocated port: {service.port}</Text>
        <Text>compilation status: {service.compilationStatus}</Text>
        <Text>start status: {service.status}</Text>
        <Text>last compilation took:</Text>
        <Text>using typescript version: 3.7.5</Text>
        <Text>last start took: </Text>
        <Text>using serverless version: 1.61.1</Text>
        <Divider />
        <Text>(l): show service logs</Text>
        <Text>(e): show compilation errors</Text>
        <Text>(s): stop service</Text>
        <Text>(r): restart service</Text>
        <Text>(b): recompile service</Text>
        <Text>(d): enable/disable service</Text>
        <Text>(t): run service tests</Text>
        <Text>(p): package service</Text>
        <Text>($): deploy service</Text>
        <Text>(escape): close menu</Text>
      </Box>
    );
  }
}
