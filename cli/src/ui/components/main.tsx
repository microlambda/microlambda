import React, { ReactNode } from 'react';
import { Box, useInput, Text } from 'ink';
import Divider from 'ink-divider';
import ServicesList from '../containers/services-list';
import PackagesList from '../containers/packages-list';
import ActionPanel from '../containers/action-panel';
import terminalSize from 'term-size';
import { showOff } from '../../utils/ascii';
import { handleUserInput } from '../inputs/handle';
import LernaStatus from '../containers/lerna-status';

export const App = (): ReactNode => {
  useInput(handleUserInput);

  // FIXME: Error message in non-lerna project
  // TODO: support resize
  const termSize = terminalSize();
  return (
    <Box height={termSize.rows - 5} width="100%" flexDirection={'column'} padding={1}>
      <Box>{showOff()}</Box>
      <LernaStatus />
      <Box>
        <Box height="100%" width="50%" flexDirection={'column'}>
          <Text bold={true}>Packages</Text>
          <Divider />
          <PackagesList />
          <Text> </Text>
          <Text bold={true}>Services</Text>
          <Divider />
          <ServicesList />
        </Box>
        <Box height="100%" width="50%" flexDirection={'column'}>
          <ActionPanel />
        </Box>
      </Box>
    </Box>
  );
};
