import React from 'react';
import { Box, Text, useInput } from 'ink';
import Divider from 'ink-divider';
import ServicesList from '../containers/services-list';
import PackagesList from '../containers/packages-list';
import { store } from '../state/store';
import { pressArrowDown, pressArrowUp } from '../state/actions/user-input';

export const App = () => {
  useInput((input, key) => {
    if (input === 'q') {
      // TODO: graceful shutdown
    }

    if (key.upArrow) {
      store.dispatch(pressArrowUp());
    }

    if (key.downArrow) {
      store.dispatch(pressArrowDown());
    }
  });

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
        Les logs iront là
      </Box>
    </Box>
  );
};
