import { magenta } from 'chalk';
import { textSync } from 'figlet';

export const showOff = () =>
  /* eslint-disable-next-line no-console */
  console.log(
    magenta(
      `\n\n`,
      textSync('MicroLambda', {
        font: 'Big Money-ne',
        horizontalLayout: 'default',
        verticalLayout: 'default',
      }),
    ),
  );
