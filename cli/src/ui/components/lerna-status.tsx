import React, { Component } from 'react';
import { Text, Box, Color } from 'ink';
import { BootstrapStatus, ILernaState } from '../state/store';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Spinner = require('ink-spinner'); // FIXME: Wrong type declaration shipped by package

export class LernaStatus extends Component<ILernaState> {
  render() {
    const lerna = this.props.lerna;
    switch (lerna.status) {
      case BootstrapStatus.READY:
      case BootstrapStatus.BUILDING_GRAPH:
        return (
          <Box flexDirection={'column'} marginTop={1} marginBottom={1}>
            <Text>
              <Spinner type={'dots'} />
              <Text> </Text>
              <Text>Parsing dependency graph</Text>
            </Text>
          </Box>
        );
      case BootstrapStatus.BOOTSTRAPPING:
        return (
          <Box flexDirection={'column'} marginTop={1} marginBottom={1}>
            <Text>
              <Color green>✓</Color>
              <Text> </Text>
              <Text>Dependency graph parsed</Text>
            </Text>
            <Text>
              <Spinner type={'dots'} />
              <Text> </Text>
              <Text>Bootstrapping dependencies 📦</Text>
              <Text> </Text>
              <Color grey>{lerna.version ? 'using lerna ' + lerna.version : ''}</Color>
            </Text>
          </Box>
        );
      case BootstrapStatus.SUCCEED:
        return (
          <Box flexDirection={'column'} marginTop={1} marginBottom={1}>
            <Text>
              <Color green>✓</Color>
              <Text> </Text>
              <Text>Dependency graph parsed</Text>
            </Text>
            <Text>
              <Color green>✓</Color>
              <Text> </Text>
              <Text>Dependencies installed 📦</Text>
              <Text> </Text>
              <Color grey>{lerna.version ? 'using lerna ' + lerna.version : ''}</Color>
            </Text>
          </Box>
        );
      default:
        return <Text>Unknown status {lerna.status}</Text>;
    }
  }
}
