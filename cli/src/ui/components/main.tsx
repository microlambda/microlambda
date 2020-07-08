import React, { Component } from 'react';
import { Box, Text } from 'ink';
import Divider from 'ink-divider';
import ServicesList from '../containers/services-list';
import PackagesList from '../containers/packages-list';

interface IState {
  selected: number;
}

export class App extends Component<{}, IState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      selected: null,
    };
  }

  render(): JSX.Element {
    return (
      <Box height="100%" width="100%">
        <Box height="100%" width="50%" flexDirection={'column'}>
          <Divider title={'Packages'} />
          <PackagesList />
          <Divider title={'Services'} />
          <ServicesList />
        </Box>
        <Box height="100%" width="50%" flexDirection={'column'}>
          <Divider title={'Logs'} />
          <Text>✓|✗</Text>
          Selected: {this.state.selected}
          Les logs iront là
        </Box>
      </Box>
    );
  }
}
