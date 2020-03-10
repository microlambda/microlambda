import { magenta, yellow } from 'chalk';
import { textSync } from 'figlet';

export const showOff = (): void =>
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
