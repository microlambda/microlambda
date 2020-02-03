import * as yargs from 'yargs';

const argv = yargs.options({
    env: {
        alias: 'e',
        choices: ['dev', 'prod'] as const,
        demandOption: true,
        description: 'app environment'
    },
    port: {
        alias: 'p',
        type: 'number',
        default: 80,
        description: 'port'
    }
})
    .check(data => !isNaN(data.port))
    .help()
    .wrap(80)
    .argv;

console.log(argv);