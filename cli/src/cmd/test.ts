/* eslint-disable no-console */
import { getDefaultThreads, getThreads, Logger, Node, RecompilationScheduler } from '@microlambda/core';
import { beforeBuild, IBuildCmd, typeCheck } from './build';
import { concat, merge, Observable } from 'rxjs';
import { spawn } from 'child_process';
import chalk from 'chalk';
import Spinnies from 'spinnies';
import { readJSONSync } from 'fs-extra';
import { join } from 'path';

interface ITestOptions extends IBuildCmd {
  recompile: boolean;
  unit: boolean;
  functional: boolean;
  C?: number;
  stdio: 'inherit' | 'ignore';
}

enum TestStatus {
  TESTING,
  PASS,
  FAIL,
  SKIPPED,
}

interface ITestEvent {
  type: 'unit' | 'functional';
  status: TestStatus;
  node: Node;
  took?: number;
}

// FIXME: Move to core
// Should be part of Service class and called by RecompilationScheduler
class TestRunner {
  private readonly _services: Node[];
  private readonly _concurrency: number;
  private readonly _type: 'unit' | 'functional' | undefined;
  private readonly _logs: Map<Node, string[]> = new Map();

  constructor(target: Node | Node[], concurrency: number, type?: 'unit' | 'functional') {
    this._services = Array.isArray(target) ? target : [target];
    this._concurrency = concurrency;
    this._type = type;
    this._logs = new Map(this._services.map((s) => [s, []]));
  }

  private _getCmd(): { cmd: string; args: string[] } {
    const cmd = 'yarn';
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

  runTests(stdio: 'ignore' | 'inherit'): Observable<ITestEvent> {
    const testNode = (node: Node, type: 'unit' | 'functional'): Observable<ITestEvent> => {
      return new Observable<ITestEvent>((obs) => {
        const now = Date.now();
        obs.next({ type, node, status: TestStatus.TESTING });
        let hasTests = false;
        const testKey = `test:${type}`;
        try {
          const packageJson = readJSONSync(join(node.getLocation(), 'package.json'));
          hasTests = packageJson.scripts && packageJson.scripts[testKey] != null;
        } catch (e) {
          console.error(e);
          obs.next({ type, node, status: TestStatus.FAIL, took: Date.now() - now });
        }
        if (!hasTests) {
          obs.next({ type, node, status: TestStatus.SKIPPED, took: Date.now() - now });
          return obs.complete();
        }
        const testProcess = spawn('yarn', ['run', `test:${type}`], {
          cwd: node.getLocation(),
          env: { ...process.env, FORCE_COLOR: '2' },
          stdio: stdio === 'ignore' ? 'pipe' : 'inherit',
        });
        if (testProcess.stderr && testProcess.stdout) {
          const appendLogs = (data: Buffer): void => {
            const logs = this._logs.get(node);
            if (logs) {
              logs.push(data.toString());
            } else {
              this._logs.set(node, [data.toString()]);
            }
          };
          testProcess.stderr.on('data', (data) => appendLogs(data));
          testProcess.stdout.on('data', (data) => appendLogs(data));
        }
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

  printLogs(service: Node): void {
    const { cmd, args } = this._getCmd();
    console.log(`${chalk.bold(service.getName())} - ${chalk.gray([cmd, ...args].join(' '))}`);
    console.log('\n');
    const logs = this._logs.get(service);
    console.log(logs ? logs.join('') : '');
    console.log('\n');
  }
}

export const runTests = async (cmd: ITestOptions, scheduler: RecompilationScheduler, logger: Logger): Promise<void> => {
  const concurrency = cmd.C ? getThreads(Number(cmd.C)) : getDefaultThreads();
  let type: 'functional' | 'unit' | undefined;
  if (cmd.functional && cmd.unit) {
    console.error(chalk.red('Cannot use both --unit and --functional flags'));
    process.exit(1);
  } else if (cmd.functional) {
    type = 'functional';
  } else if (cmd.unit) {
    type = 'unit';
  }
  if (!['inherit', 'ignore'].includes(cmd.stdio)) {
    console.error(chalk.red('Invalid --stdio flag', cmd.stdio));
    console.error(chalk.red('Should be whether inherit or ignore'));
    process.exit(1);
  }
  const { graph, service } = await beforeBuild(cmd, scheduler, logger, true);
  const target = service ? service : graph;
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
  const runner = new TestRunner(service ? service : graph.getNodes(), concurrency, type);
  const failures: Node[] = [];
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
      case TestStatus.SKIPPED: {
        spinnies.succeed(evt.node.getName(), {
          text: `${chalk.black.bgYellow(' SKIPPED ')} [${chalk.cyan(
            evt.type,
          )}] ${evt.node.getName()} - No script test:${evt.type} in package.json`,
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
  runner.runTests(cmd.stdio).subscribe(onNext, onError, onComplete);
};
