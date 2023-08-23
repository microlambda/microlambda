import {RunCommandEvent, RunCommandEventEnum, RunOptions} from '../../src';
import {delay, from, mergeAll, Observable, of, switchMap, throwError} from 'rxjs';
import {SinonStub} from "sinon";
import {IProcessResult, Project, OrderedTargets} from "../../src";
import {WatchEvent} from "../../src/watcher";
type ReceivedEventV2 = {type: RunCommandEventEnum, workspace?: string, delay?: number};

const logger = (...args: unknown[]): void => {
  if (process.env.DEBUG_RUNNER_TESTS) {
    console.debug(args);
  }
}

export const mockSourcesChange = (project: Project, targets: OrderedTargets, changes: Array<{ workspaceNames: string[], delay: number }>): Observable<Array<WatchEvent>> => {
  const fakeEvents$: Array<Observable<Array<WatchEvent>>> = changes.map((changes) => {
    return of(changes.workspaceNames.map((w) => {
      const workspace = project.workspaces.get(w);
      if (!workspace) {
        throw new Error('Cannot mock fs event for unknown workspace ' + w);
      }
      return {
        target: {
          workspace,
          hasCommand: targets.flat().find((t) => t.workspace.name === workspace.name)?.hasCommand ?? false,
        },
        events: [{
          event: 'change' as const,
          path: '/what/ever'
        }]
      }
    })).pipe(delay(changes.delay));
  });
  return from(fakeEvents$).pipe(mergeAll());
};

export enum ObservableEvent {
  COMPLETE = 'complete',
  ERROR = 'error',
}

const verifyAssertionsV2 = (
  expectedTimeframe: ReceivedEventV2[][],
  expectedCompletion: ObservableEvent | number,
  receivedEvents: ReceivedEventV2[],
  receivedCompletion: ObservableEvent | undefined,
) => {
  console.debug('received', receivedEvents);
  console.debug('expected', expectedTimeframe.flat());

  if (expectedCompletion === ObservableEvent.COMPLETE && receivedCompletion !== ObservableEvent.COMPLETE) {
    throw new Error('Expected observable to complete');
  }
  if (expectedCompletion === ObservableEvent.ERROR && receivedCompletion !== ObservableEvent.ERROR) {
    throw new Error('Expected observable to error');
  }
  if (typeof expectedCompletion === 'number' && receivedCompletion !== undefined) {
    throw new Error('Expected observable to neither complete nor error');
  }
  const expectedEvents = expectedTimeframe.flat();
  if (expectedEvents.length !== receivedEvents.length) {
    throw new Error(`Events count mismatch:
        expected: ${expectedEvents.length}
        received: ${receivedEvents.length}`);
  }
  let currentIndex = 0;
  const mismatchError = new Error(`Mismatch between expected events and received events:
  Expected:
  ${JSON.stringify(expectedEvents, null, 2)}
    Received:
  ${JSON.stringify(receivedEvents, null, 2)}
  `);

  const compare = (arr1: ReceivedEventV2[], arr2: ReceivedEventV2[]): boolean => {
    const predicate = (e1: ReceivedEventV2, e2: ReceivedEventV2): number => {
      if (e1.type === e2.type && e1.workspace && e2.workspace) {
        return e1.workspace.localeCompare(e2.workspace);
      }
      return e1.type.localeCompare(e2.type);
    };
    const _arr1: ReceivedEventV2[] = JSON.parse(JSON.stringify(arr1));
    const _arr2: ReceivedEventV2[] = JSON.parse(JSON.stringify(arr2));
    _arr1.forEach((e) => delete e.delay);
    _arr2.forEach((e) => delete e.delay);
    return JSON.stringify(_arr1.sort(predicate)) === JSON.stringify(_arr2.sort(predicate));
  }

  for (const expectedSlice of expectedTimeframe) {
     const receivedSlice = receivedEvents.slice(currentIndex, currentIndex + expectedSlice.length);
     if (!compare(receivedSlice, expectedSlice)) {
       console.debug({receivedSlice, expectedSlice})
       throw mismatchError;
     }
     currentIndex += expectedSlice.length;
  }
}

export const expectObservableV2 = async (
  startedAt: number,
  runCommand$: Observable<RunCommandEvent>,
  expectedTimeframe: ReceivedEventV2[][],
  expectedCompletion: ObservableEvent | number,
) => {

  return new Promise<void>((resolve, reject) => {
    const receivedEvents: ReceivedEventV2[] = [];
    let timeout: NodeJS.Timeout | undefined;
    const timedOut = () => {
      if (typeof expectedCompletion === 'number') {
        if (timeout) {
          clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
          logger('+', Date.now() - startedAt, 'ms', 'TIMEOUT REACHED')
          verifyAssertionsV2(expectedTimeframe, expectedCompletion, receivedEvents, undefined);
          resolve();
        }, expectedCompletion);
      }
    }
    runCommand$.subscribe({
      next: (evt) => {
        switch (evt.type) {
          case RunCommandEventEnum.TARGETS_RESOLVED:
            receivedEvents.push({type: evt.type, delay: Date.now() - startedAt});
            break;
          case RunCommandEventEnum.NODE_STARTED:
          case RunCommandEventEnum.NODE_ERRORED:
          case RunCommandEventEnum.NODE_PROCESSED:
            if (evt.type === RunCommandEventEnum.NODE_PROCESSED) {
              logger(evt.result)
            }
          case RunCommandEventEnum.NODE_SKIPPED:
          case RunCommandEventEnum.ERROR_INVALIDATING_CACHE:
          case RunCommandEventEnum.CACHE_INVALIDATED:
          case RunCommandEventEnum.NODE_INTERRUPTING:
          case RunCommandEventEnum.NODE_INTERRUPTED:
            logger('+', Date.now() - startedAt, 'ms', {type: evt.type, workspace: evt.target.workspace?.name});
            receivedEvents.push({type: evt.type, workspace: evt.target.workspace?.name, delay: Date.now() - startedAt});
            break;
          case RunCommandEventEnum.SOURCES_CHANGED:
            logger('+', Date.now() - startedAt, 'ms', {type: evt.type, workspace: evt.target.workspace?.name});
            receivedEvents.push({type: evt.type, workspace: evt.target.workspace?.name, delay: Date.now() - startedAt});
            break;
          default:
            logger('+', Date.now() - startedAt, 'ms', 'Unexpected event type', evt);
            reject();
            break;
        }
        timedOut();
      },
      error: (err) => {
        console.error(err);
        logger('+', Date.now() - startedAt, 'ms', 'ERRORED', err);
        verifyAssertionsV2(expectedTimeframe, expectedCompletion, receivedEvents, ObservableEvent.ERROR);
        resolve();
      },
      complete: () => {
        logger('+', Date.now() - startedAt, 'ms', 'COMPLETED');
        verifyAssertionsV2(expectedTimeframe, expectedCompletion, receivedEvents, ObservableEvent.COMPLETE);
        resolve();
      },
    });
  });
}

export const resolveAfter = <T>(value: T, ms: number): Promise<T> => new Promise<T>((resolve) => {
  setTimeout(() => resolve(value), ms);
});

export const rejectAfter = <E>(error: E, ms: number): Promise<never> => new Promise<never>((resolve, reject) => {
  setTimeout(() => reject(error), ms);
});

interface IRunStub {
  resolve: boolean;
  killed?: number;
  options?: RunOptions;
  fromCache?: boolean;
  delay?: number;
  error?: unknown;
}

export const stubRun = (stub: SinonStub | undefined, calls: IRunStub[]) => {
  if (stub) {
    calls.forEach((call, idx) => {
      if (call.resolve) {
        stub.withArgs(call.options).onCall(idx).returns(of({
          commands:[],
          overall: call.delay || 0,
          fromCache: call.fromCache || false,
        }).pipe(delay(call.delay || 0)))
      } else {
        stub.withArgs(call.options).onCall(idx).returns(of('').pipe(
          delay(call.delay || 0),
          switchMap(() => throwError(call.error))
        ))
      }
    });
  }
}

export const stubRunV2 = (stub: SinonStub | undefined, calls: Map<string, Array<IRunStub>>) => {
  if (stub) {
    stub.callsFake((...args) => {
      const [options, workspace] = args;
      if (!workspace) {
        throw new Error('Second argument test fixture not used');
      }
      if (!calls.has(workspace)) {
        throw new Error(`No stubs provided for workspace ${workspace}`);
      }
      const call = calls.get(workspace)?.shift();
      if (!call) {
        throw new Error(`No more stubs provided for workspace ${workspace}`);
      }
      if (call.options && JSON.stringify(options) !== JSON.stringify(call.options)) {
        throw new Error(`Stubbed methods called with incorrect options for workspace ${workspace}.
        Expected:
        ${JSON.stringify(call.options, null, 2)}
        Received:
        ${JSON.stringify(options, null, 2)
        }`);
      }
      return new Observable<IProcessResult>((obs) => {
        logger('(mock) Running command', workspace);
        if (call.killed) {
          setTimeout(() => {
            logger('(mock) Killed Running command', workspace);
            obs.complete()
          }, call.killed ?? 0);
        }
        if (call.resolve) {
          setTimeout(() => {
            logger('(mock) Success Running command', workspace);
            obs.next({
              commands:[],
              overall: call.delay || 0,
              fromCache: call.fromCache || false,
            });
            obs.complete();
          }, call.delay ?? 0);
        } else {
          setTimeout(() => {
            logger('(mock) Failed Running command', workspace);
            obs.error(call.error ?? new Error('Fake error'));
          }, call.delay ?? 0);
        }
      });
    });
  }
}

interface IKillStub {
  cmd: string;
  delay: number;
  pids?: number[];
}

export const stubKill = (stub: SinonStub | undefined, calls: Map<string, Array<IKillStub>>) => {
  if (stub) {
    stub.callsFake((...args) => {
      const [options] = args;
      const workspace = options._workspace;
      if (!workspace) {
        throw new Error('Test fixture not used');
      }
      if (!calls.has(workspace)) {
        throw new Error(`No stubs provided for workspace ${workspace}`);
      }
      const call = calls.get(workspace)?.shift();
      if (!call) {
        throw new Error(`No more stubs provided for workspace ${workspace}`);
      }
      if (call.cmd && JSON.stringify(options) !== JSON.stringify({ cmd: call.cmd, _workspace: workspace })) {
        throw new Error(`Stubbed methods called with incorrect options for workspace ${workspace}.
        Expected:
        ${JSON.stringify({ cmd: call.cmd, _workspace: workspace }, null, 2)}
        Received:
        ${JSON.stringify(options, null, 2)
        }`);
      }
      logger('(mock) killing', workspace, call);
      return new Promise<Array<number>>((resolve) => setTimeout(() => resolve(call.pids ?? []), call.delay ?? 0));
    });
  }
}
