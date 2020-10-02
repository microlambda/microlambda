import { Logger } from '../utils/logger';
import {
  RecompilationScheduler,
} from '../utils/scheduler';
import { beforeBuild, IBuildCmd, typeCheck } from './build';
import { Service } from '../lerna';
import { concat, merge, Observable } from 'rxjs';
import { spawn } from 'child_process';
import chalk from 'chalk';
import { getDefaultThreads, getThreads } from '../utils/platform';
import Spinnies from 'spinnies';

interface ITestOptions extends IBuildCmd {
  recompile: boolean;
  unit: boolean;
  functional: boolean;
  C?: number;
}

export const runTests = async (
  cmd: ITestOptions,
  scheduler: RecompilationScheduler,
  logger: Logger,
): Promise<void> => {
  const concurrency = cmd.C ? getThreads(Number(cmd.C)) : getDefaultThreads();
  let  type: 'functional' | 'unit' = null;
  if (cmd.functional && cmd.unit) {
    console.error(chalk.red('Cannot use both --unit and --functional flags'));
    process.exit(1);
  } else if (cmd.functional) {
    type = 'functional';
  } else if (cmd.unit) {
    type = 'unit';
  }
  const { graph, service } = await beforeBuild(cmd, scheduler, logger);
  const target = cmd.S ? service : graph;
  if (cmd.recompile) {
    try {
      console.info('\nBuilding dependency graph\n');
      await typeCheck(scheduler, target, cmd.onlySelf, false);
    } catch (e) {
      process.exit(1);
    }
  }
  console.info('\nRunning tests\n');
  const spinnies = new Spinnies({
    failColor: 'white',
    succeedColor: 'white',
    spinnerColor: 'cyan',
  });
  const runner = new TestRunner(cmd.S ? service : graph.getServices(), concurrency, type);
  const failures: Service[] = [];
  const onNext = (evt: ITestEvent) => {
    switch (evt.status) {
      case TestStatus.TESTING: {
        spinnies.add(evt.service.getName(), {text: `[${evt.type}] Testing ${evt.service.getName()}`});
        break;
      }
      case TestStatus.PASS: {
        spinnies.succeed(evt.service.getName(), {text: `${chalk.black.bgGreen(' PASS ')} [${chalk.cyan(evt.type)}] ${evt.service.getName()} ${chalk.gray(evt.took + 'ms')}`});
        break;
      }
      case TestStatus.FAIL: {
        failures.push(evt.service);
        spinnies.succeed(evt.service.getName(), {text: `${chalk.black.bgRedBright(' FAIL ')} [${chalk.cyan(evt.type)}] ${evt.service.getName()} ${chalk.gray(evt.took + 'ms')}`});
      }
    }

  };
  const onError = (evt: ITestEvent) => {
    spinnies.fail(evt.service.getName(), { text: `[${evt.type}]  Error testing ${evt.service.getName()}`})
    failures.push(evt.service);
  };
  const onComplete = () => {
    if (failures.length) {
      failures.forEach(s => runner.printLogs(s));
      process.exit(1);
    }
    process.exit(0);
  }
  runner.runTests().subscribe(onNext, onError, onComplete);
};

enum TestStatus {
  TESTING,
  PASS,
  FAIL,
}

interface ITestEvent {
  type: 'unit' |'functional';
  status: TestStatus;
  service: Service;
  took?: number;
}

class TestRunner {

  private readonly _services: Service[];
  private readonly _concurrency: number;
  private readonly _type: 'unit' | 'functional';
  private readonly _logs: Map<Service, string[]> = new Map();

  constructor(target: Service | Service[], concurrency: number, type?: 'unit' | 'functional' ) {
    this._services = Array.isArray(target) ? target : [target];
    this._concurrency = concurrency;
    this._type = type;
    this._logs = new Map(this._services.map(s => [s, []]));
  }

  private _getCmd() {
    const cmd = 'npm';
    let args: string[];
    if (!this._type) {
      args = ['test'];
    } else if (this._type === 'unit') {
      args = ['run', 'test:unit'];
    } else {
      args = ['run', 'test:functional'];
    }
    return { cmd, args };
  }

  runTests(): Observable<ITestEvent> {
    const testService = (service: Service, type: 'unit' | 'functional'): Observable<ITestEvent> => {
      return new Observable<ITestEvent>((obs) => {
        const now=  Date.now();
        obs.next({type, service, status: TestStatus.TESTING});
        const testProcess = spawn('npm', ['run', `test:${type}`], { cwd: service.getLocation(), env: {...process.env, FORCE_COLOR: '2'} });
        testProcess.stderr.on('data', (data) => {
          this._logs.get(service).push(data.toString());
        });
        testProcess.stdout.on('data', (data) => {
          // this._logs.get(service).push(data.toString());
        });
        testProcess.on('close', (code) => {
          if (code !== 0) {
            obs.next({type, service, status: TestStatus.FAIL, took: Date.now() - now});
            return obs.complete();
          }
          obs.next({type, service, status: TestStatus.PASS, took: Date.now() - now});
          return obs.complete();
        });
        testProcess.on('error', (err) => {
          console.error(err);
          obs.next({type, service, status: TestStatus.FAIL, took: Date.now() - now});
          return obs.complete();
        });
      })
    }

    const hasUnit = !this._type || this._type === 'unit';
    const hasFunctional = !this._type || this._type === 'functional';
    const unitTestJobs$ = hasUnit ? this._services.map(s => testService(s, 'unit')) : [];
    const functionalTestJobs$ = hasFunctional ? this._services.map(s => testService(s, 'functional')) : [];

    const unit$ = merge(...unitTestJobs$, this._concurrency)
    const functional$ = concat(...functionalTestJobs$);
    return concat(unit$, functional$);
  }

  printLogs(service: Service): void {
    const  { cmd, args } = this._getCmd();
    console.log(`${chalk.bold(service.getName())} - ${chalk.gray([cmd, ...args].join(' '))}`);
    console.log('\n');
    console.log(this._logs.get(service).join(''));
    console.log('\n');
  }
}
