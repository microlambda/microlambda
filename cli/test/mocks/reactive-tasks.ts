import { Observable, timer } from 'rxjs';
import { LernaNode, Service } from '../../src/lerna';
import { map, take } from 'rxjs/operators';

const randomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1) + min);
};

export const compiledNode = (node: LernaNode, ms = randomInt(50, 100)): Observable<LernaNode> => {
  return timer(0, ms).pipe(
    take(1),
    map(() => node),
  );
};

export const startedService = (service: Service, ms = randomInt(50, 100)): Observable<Service> => {
  return timer(0, ms).pipe(
    take(1),
    map(() => service),
  );
};
