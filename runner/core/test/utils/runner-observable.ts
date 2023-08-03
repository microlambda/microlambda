import {RunCommandEvent, RunCommandEventEnum, RunOptions} from '../../src';
import {delay, Observable, of, switchMap, throwError} from 'rxjs';
import {SinonStub} from "sinon";
import {IProcessResult} from "../../lib";

const equals = (arr1: Array<boolean | number | string>, arr2: Array<boolean | number | string>) => JSON.stringify(arr1) === JSON.stringify(arr2);
const areEquivalent = (arr1: Array<boolean | number | string>, arr2: Array<boolean | number | string>) => equals(arr1.sort(), arr2.sort());

type ReceivedEvent = {type: RunCommandEventEnum | 'X', workspace?: string};
type ReceivedEventV2 = {type: RunCommandEventEnum, workspace?: string, delay?: number};

const logger = (...args: unknown[]): void => {
  if (true) {
    console.debug(args);
  }
}

const expectTimeframe = (
  receivedEvents: ReceivedEvent[],
  expectedTimeframe: string,
  reject: (err: unknown) => void,
) => {
  logger(receivedEvents);
  const expectedFrames = expectedTimeframe.split('-');
  const expectedEventCount = expectedFrames.map((frame) => [...frame]).reduce((acc, val) => acc += val.length, 0);
  if (expectedEventCount !== receivedEvents.length) {
    reject(`Events count mismatch:
        expected: ${expectedEventCount}
        received: ${receivedEvents.length}`)
  }
  let offset = 0;
  let timeframeError = false;
  let receivedFrame = '';
  for (const expectedFrame of expectedFrames) {
    logger({ offset });
    const expectedEventTypes: (number | 'X')[] = [...expectedFrame].map((t) => t === 'X' ? 'X' : Number(t));
    const receivedEventTypes = receivedEvents.slice(offset, offset + expectedEventTypes.length).map((e) => e.type);
    logger({ expectedEventTypes, receivedEventTypes });
    const isComparable = areEquivalent(receivedEventTypes, expectedEventTypes);
    if (!isComparable) {
      timeframeError = true;
    }
    logger(receivedEventTypes.join(''));
    receivedFrame += (offset ? '-' : '') + receivedEventTypes.join('')
    offset += expectedEventTypes.length;
  }
  if (timeframeError) {
    reject(`Timeframe error:
          expected: ${expectedTimeframe}
          received: ${receivedFrame}`)
  }
}

const expectWorkspaces = (
  receivedEvents: ReceivedEvent[],
  expectedWorkspaces: { [idx: number]: string[] },
  reject: (err: unknown) => void,
) => {
  for (const type of [1, 2, 3, 4, 5, 6]) {
    if (expectedWorkspaces[type]) {
      const receivedWorkspaces = receivedEvents
        .filter((e) => e.type === type)
        .map((e) => e.workspace!);
      if (!areEquivalent(receivedWorkspaces, expectedWorkspaces[type])) {
        reject(`Received values mismatch (${type}):
          received: ${receivedWorkspaces}
          expected: ${expectedWorkspaces[type]}`);
      }
    }
  }
}

const verifyAssertions = (
  receivedEvents: ReceivedEvent[],
  expectedTimeframe: string,
  expectedWorkspaces: { [idx: number]: string[] },
  resolve: () => void,
  reject: (err: unknown) => void,
  predicate?: (received: ReceivedEvent[]) => void,
) => {
  expectTimeframe(receivedEvents, expectedTimeframe, reject);
  expectWorkspaces(receivedEvents, expectedWorkspaces, reject);
  if (predicate) {
    predicate(receivedEvents);
  }
  resolve();
}

export const expectObservable = async (
  startedAt: number,
  runCommand$: Observable<RunCommandEvent>,
  expectedTimeframe: string,
  expectedWorkspaces: { [idx: number]: string[] },
  predicate?: (received: ReceivedEvent[]) => void,
  completeAfter?: number,
) => {

  return new Promise<void>((resolve, reject) => {
    const receivedEvents: ReceivedEvent[] = [];
    let timeout: NodeJS.Timeout | undefined;
    const timedOut = () => {
      if (completeAfter) {
        if (timeout) {
          clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
          logger('+', Date.now() - startedAt, 'ms', 'TIMEOUT REACHED')
          console.debug(receivedEvents);
          verifyAssertions(receivedEvents, expectedTimeframe, expectedWorkspaces, resolve, reject, predicate);
        }, completeAfter);
      }
    }
    runCommand$.subscribe((evt) => {
      //logger('+', Date.now() - startedAt, 'ms', evt);
      switch (evt.type) {
        case RunCommandEventEnum.TARGETS_RESOLVED:
          logger('+', Date.now() - startedAt, 'ms', 'targets changed', evt.targets.map((t) => t.workspace.name));
          receivedEvents.push({ type: evt.type });
          break;
        case RunCommandEventEnum.NODE_STARTED:
        case RunCommandEventEnum.NODE_ERRORED:
        case RunCommandEventEnum.NODE_PROCESSED:
        case RunCommandEventEnum.NODE_SKIPPED:
        case RunCommandEventEnum.ERROR_INVALIDATING_CACHE:
        case RunCommandEventEnum.CACHE_INVALIDATED:
        case RunCommandEventEnum.NODE_INTERRUPTED:
          logger('+', Date.now() - startedAt, 'ms', { type: evt.type, workspace: evt.workspace?.name });
          receivedEvents.push({ type: evt.type, workspace: evt.workspace?.name });
          break;
        case RunCommandEventEnum.SOURCES_CHANGED:
          logger('+', Date.now() - startedAt, 'ms', { type: evt.type, workspace: evt.target.workspace?.name });
          receivedEvents.push({ type: evt.type, workspace: evt.target.workspace?.name });
          break;
        default:
          logger('+', Date.now() - startedAt, 'ms', 'Unexpected event type', evt);
          reject();
          break;
      }
      timedOut();
    }, (err) => {
      logger('+', Date.now() - startedAt, 'ms', 'ERRORED', err);
      receivedEvents.push({
        type: 'X' as const,
      })
      console.debug(receivedEvents);
      verifyAssertions(receivedEvents, expectedTimeframe, expectedWorkspaces, resolve, reject, predicate);
    }, () => {
      logger('+', Date.now() - startedAt, 'ms', 'COMPLETED');
      console.debug(receivedEvents);
      verifyAssertions(receivedEvents, expectedTimeframe, expectedWorkspaces, resolve, reject, predicate);
    });
  });
}

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
      return e2.type - e1.type;
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
          console.debug(receivedEvents);
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
              console.debug(evt.result)
            }
          case RunCommandEventEnum.NODE_SKIPPED:
          case RunCommandEventEnum.ERROR_INVALIDATING_CACHE:
          case RunCommandEventEnum.CACHE_INVALIDATED:
          case RunCommandEventEnum.NODE_INTERRUPTED:
            logger('+', Date.now() - startedAt, 'ms', {type: evt.type, workspace: evt.workspace?.name});
            receivedEvents.push({type: evt.type, workspace: evt.workspace?.name, delay: Date.now() - startedAt});
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
        if (call.killed) {
          setTimeout(() => obs.complete(), call.killed ?? 0);
        }
        if (call.resolve) {
          setTimeout(() => {
            obs.next({
              commands:[],
              overall: call.delay || 0,
              fromCache: call.fromCache || false,
            });
            obs.complete();
          }, call.delay ?? 0);
        } else {
          setTimeout(() => {
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
      return new Promise<void>((resolve) => setTimeout(() => resolve(), call.delay ?? 0));
    });
  }
}
