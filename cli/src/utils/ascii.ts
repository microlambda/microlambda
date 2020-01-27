import * as chalk from 'chalk';

const figlet = require('figlet');

export const showOff = () => console.log(chalk.cyan(`\n\n`, figlet.textSync('NX-SLS', {
  font: 'Big Money-ne',
  horizontalLayout: 'default',
  verticalLayout: 'default'
})));
