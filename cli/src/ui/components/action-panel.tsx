import React, { Component } from 'react';
import { Text, Box } from 'ink';
import Divider from 'ink-divider';
import { IPackageListProps } from './packages-list';
import { IServiceListProps } from './services-list';

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
    return (
      <Box flexDirection={'column'}>
        <Text bold={true}>{selectedNode.name}</Text>
        <Divider />
        <Text>version: {selectedNode.version}</Text>
        <Text>allocated port: {selectedNode.version}</Text>
        <Text>compilation status: {selectedNode.version}</Text>
        <Text>start status: {selectedNode.version}</Text>
        <Text>last compilation took: {selectedNode.version}</Text>
        <Text>last start took: {selectedNode.version}</Text>
        <Divider />
        <Text>(l): display service logs</Text>
        <Text>(s): stop service</Text>
        <Text>(r): restart service</Text>
        <Text>(b): recompile service</Text>
        <Text>(e): enable service</Text>
        <Text>(d): disable service</Text>
        <Text>(t): run service tests</Text>
        <Text>(p): package service</Text>
        <Text>($): deploy service</Text>
        <Text>(escape): close menu</Text>
      </Box>
    );
  }
}
