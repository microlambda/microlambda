import { magenta, yellow } from 'chalk';
import { textSync } from 'figlet';

export const showOff = (): string =>
  magenta(
    'v0.1.0-alpha',
    `\n\n`,
    textSync('MicroLambda', {
      font: 'Big Money-ne',
      horizontalLayout: 'default',
      verticalLayout: 'default',
    }),
  );

export const showOffTitle = (name: string): void => {
  /* eslint-disable-next-line no-console */
  console.log(
    yellow(
      `\n\n`,
      textSync(name, {
        font: 'Small',
        horizontalLayout: 'default',
        verticalLayout: 'default',
      }),
    ),
  );
};
