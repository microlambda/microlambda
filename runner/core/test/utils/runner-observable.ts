import { RunCommandEvent, RunCommandEventEnum } from '../../src';
import { Observable } from 'rxjs';

const equals = (arr1: Array<boolean | number | string>, arr2: Array<boolean | number | string>) => JSON.stringify(arr1) === JSON.stringify(arr2);
const areEquivalent = (arr1: Array<boolean | number | string>, arr2: Array<boolean | number | string>) => equals(arr1.sort(), arr2.sort());

type ReceivedEvent = {type: RunCommandEventEnum | 'X', workspace?: string};

const logger = (...args: unknown[]): void => {
  if (process.env.DEBUG_MILA_TEST) {
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
          verifyAssertions(receivedEvents, expectedTimeframe, expectedWorkspaces, resolve, reject, predicate);
        }, completeAfter);
      }
    }
    runCommand$.subscribe((evt) => {
      //logger('+', Date.now() - startedAt, 'ms', evt);
      switch (evt.type) {
        case RunCommandEventEnum.TARGETS_RESOLVED:
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
      verifyAssertions(receivedEvents, expectedTimeframe, expectedWorkspaces, resolve, reject, predicate);
    }, () => {
      logger('+', Date.now() - startedAt, 'ms', 'COMPLETED');
      verifyAssertions(receivedEvents, expectedTimeframe, expectedWorkspaces, resolve, reject, predicate);
    });
  });
}
