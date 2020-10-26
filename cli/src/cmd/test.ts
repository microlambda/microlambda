/* eslint-disable no-console */
import { Logger } from '../utils/logger';
import { RecompilationScheduler } from '../utils/scheduler';
import { beforeBuild, IBuildCmd, typeCheck } from './build';
import { LernaNode } from '../lerna';
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

enum TestStatus {
  TESTING,
  PASS,
  FAIL,
}

interface ITestEvent {
  type: 'unit' | 'functional';
  status: TestStatus;
  node: LernaNode;
  took?: number;
}

class TestRunner {
  private readonly _services: LernaNode[];
  private readonly _concurrency: number;
  private readonly _type: 'unit' | 'functional';
  private readonly _logs: Map<LernaNode, string[]> = new Map();

  constructor(target: LernaNode | LernaNode[], concurrency: number, type?: 'unit' | 'functional') {
    this._services = Array.isArray(target) ? target : [target];
    this._concurrency = concurrency;
    this._type = type;
    this._logs = new Map(this._services.map((s) => [s, []]));
  }

  private _getCmd(): { cmd: string; args: string[] } {
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
    const testNode = (node: LernaNode, type: 'unit' | 'functional'): Observable<ITestEvent> => {
      return new Observable<ITestEvent>((obs) => {
        const now = Date.now();
        obs.next({ type, node, status: TestStatus.TESTING });
        const testProcess = spawn('npm', ['run', `test:${type}`], {
          cwd: node.getLocation(),
          env: { ...process.env, FORCE_COLOR: '2' },
        });
        testProcess.stderr.on('data', (data) => {
          this._logs.get(node).push(data.toString());
        });
        testProcess.stdout.on('data', (data) => {
          this._logs.get(node).push(data.toString());
        });
        testProcess.on('close', (code) => {
          if (code !== 0) {
            obs.next({ type, node, status: TestStatus.FAIL, took: Date.now() - now });
            return obs.complete();
          }
          obs.next({ type, node, status: TestStatus.PASS, took: Date.now() - now });
          return obs.complete();
        });
        testProcess.on('error', (err) => {
          console.error(err);
          obs.next({ type, node, status: TestStatus.FAIL, took: Date.now() - now });
          return obs.complete();
        });
      });
    };

    const hasUnit = !this._type || this._type === 'unit';
    const hasFunctional = !this._type || this._type === 'functional';
    const unitTestJobs$ = hasUnit ? this._services.map((s) => testNode(s, 'unit')) : [];
    const functionalTestJobs$ = hasFunctional ? this._services.map((s) => testNode(s, 'functional')) : [];

    const unit$ = merge(...unitTestJobs$, this._concurrency);
    const functional$ = concat(...functionalTestJobs$);
    return concat(unit$, functional$);
  }

  printLogs(service: LernaNode): void {
    const { cmd, args } = this._getCmd();
    console.log(`${chalk.bold(service.getName())} - ${chalk.gray([cmd, ...args].join(' '))}`);
    console.log('\n');
    console.log(this._logs.get(service).join(''));
    console.log('\n');
  }
}

export const runTests = async (cmd: ITestOptions, scheduler: RecompilationScheduler, logger: Logger): Promise<void> => {
  const concurrency = cmd.C ? getThreads(Number(cmd.C)) : getDefaultThreads();
  let type: 'functional' | 'unit' = null;
  if (cmd.functional && cmd.unit) {
    console.error(chalk.red('Cannot use both --unit and --functional flags'));
    process.exit(1);
  } else if (cmd.functional) {
    type = 'functional';
  } else if (cmd.unit) {
    type = 'unit';
  }
  const { graph, service } = await beforeBuild(cmd, scheduler, logger, true);
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
  const runner = new TestRunner(cmd.S ? service : graph.getNodes(), concurrency, type);
  const failures: LernaNode[] = [];
  const onNext = (evt: ITestEvent): void => {
    switch (evt.status) {
      case TestStatus.TESTING: {
        spinnies.add(evt.node.getName(), { text: `[${evt.type}] Testing ${evt.node.getName()}` });
        break;
      }
      case TestStatus.PASS: {
        spinnies.succeed(evt.node.getName(), {
          text: `${chalk.black.bgGreen(' PASS ')} [${chalk.cyan(evt.type)}] ${evt.node.getName()} ${chalk.gray(
            evt.took + 'ms',
          )}`,
        });
        break;
      }
      case TestStatus.FAIL: {
        failures.push(evt.node);
        spinnies.succeed(evt.node.getName(), {
          text: `${chalk.black.bgRedBright(' FAIL ')} [${chalk.cyan(evt.type)}] ${evt.node.getName()} ${chalk.gray(
            evt.took + 'ms',
          )}`,
        });
      }
    }
  };
  const onError = (evt: ITestEvent): void => {
    spinnies.fail(evt.node.getName(), { text: `[${evt.type}]  Error testing ${evt.node.getName()}` });
    failures.push(evt.node);
  };
  const onComplete = (): void => {
    if (failures.length) {
      failures.forEach((s) => runner.printLogs(s));
      process.exit(1);
    }
    process.exit(0);
  };
  runner.runTests().subscribe(onNext, onError, onComplete);
};
