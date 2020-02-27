/**
 Lerna graph is one of the most important class of the project.
 The dependency graph is built at the beginning of the start command.
 It is very important to know the dependencies between package to:
 - compile packages in the correct order: if package B depends on A and you try to compile package B before A, it
   will fail.
 - stop all impacted services when watcher is triggered because a shared dependency is modified.

 The LernaGraph constructor is responsible for building this graph from lerna commands outputs.
 Let's take this dependency graph for testing purpose.


                                          service C
                                        /   |       \
                                      /     |        \
               service A  service B ---      \        \
                  \        /               / \         \
                   \       /             /  \      package G
                   package D           /   \      /
                  /                   /    \     /
                 /                   /     \    /
            package E------------- /       package F
 */
import { LernaGraph, Package, Service } from '../../../src/lerna';
import { graph1 } from '../../factories/graph-1';
import { config1 } from '../../factories/config-1';
import { SinonStub, stub } from 'sinon';
import fs from 'fs';
import { EventEmitter } from 'events';
import child_process, { ChildProcess } from 'child_process';
import { RecompilationScheduler } from '../../../src/utils/scheduler';

const scheduler = new RecompilationScheduler();
let graph: LernaGraph;
let existsSync: SinonStub;

describe('The LernaGraph class', () => {
  beforeAll(() => {
    existsSync = stub(fs, 'existsSync');
    existsSync.withArgs('path/to/service/serverless.yml').returns(true);
    existsSync.withArgs('path/to/package/serverless.yml').returns(false);
    graph = new LernaGraph(graph1, __dirname, config1);
  });
  afterAll(() => {
    existsSync.restore();
  });
  describe('The constructor', () => {
    test('should build 7 lerna nodes including 3 services and 4 packages', () => {
      expect(graph.getNodes().length).toBe(7);
      expect(graph.getNodes().filter((n) => n instanceof Package).length).toBe(4);
      expect(graph.getNodes().filter((n) => n instanceof Service).length).toBe(3);
    });
    test('A should have children D', () => {
      expect(graph.get('serviceA').getChildren().length).toBe(1);
      expect(graph.get('serviceA').getChildren()).toContain(graph.get('packageD'));
    });
    test('B should have children D', () => {
      expect(graph.get('serviceB').getChildren().length).toBe(1);
      expect(graph.get('serviceB').getChildren()).toContain(graph.get('packageD'));
    });
    test('C should have children B,E,F,G', () => {
      expect(graph.get('serviceC').getChildren().length).toBe(4);
      expect(graph.get('serviceC').getChild('serviceB')).toBe(graph.get('serviceB'));
      expect(graph.get('serviceC').getChild('packageE')).toBe(graph.get('packageE'));
      expect(graph.get('serviceC').getChild('packageF')).toBe(graph.get('packageF'));
      expect(graph.get('serviceC').getChild('packageG')).toBe(graph.get('packageG'));
    });
    test('D should have children E', () => {
      expect(graph.get('packageD').getChildren().length).toBe(1);
      expect(graph.get('packageD').getChildren()).toContain(graph.get('packageE'));
    });
    test('E should not have children', () => {
      expect(graph.get('packageE').getChildren().length).toBe(0);
    });
    test('F should not have children', () => {
      expect(graph.get('packageF').getChildren().length).toBe(0);
    });
    test('G should have children F', () => {
      expect(graph.get('packageG').getChildren().length).toBe(1);
      expect(graph.get('packageG').getChildren()).toContain(graph.get('packageF'));
    });
    test('All nodes should be disabled', () => {
      expect(graph.getNodes().every((n) => !n.isEnabled())).toBe(true);
    });
    test('should map ports according to the config if given', () => {
      expect(graph.getPort('serviceA')).toBe(4598);
      expect(graph.getPort('serviceB')).toBe(3001);
      expect(graph.getPort('serviceC')).toBe(3002);
    });
    test('should map ports with default port fallback', () => {
      const otherGraph = new LernaGraph(graph1, __dirname, { ports: {}, noStart: [] }, 4800);
      expect(otherGraph.getPort('serviceA')).toBe(4800);
      expect(otherGraph.getPort('serviceB')).toBe(4801);
      expect(otherGraph.getPort('serviceC')).toBe(4802);
    });
  });
  describe('The get packages method', () => {
    test('should return D, E, F, G', () => {
      const packages = graph.getPackages();
      expect(packages).toHaveLength(4);
      expect(packages).toContain(graph.get('packageD'));
      expect(packages).toContain(graph.get('packageE'));
      expect(packages).toContain(graph.get('packageF'));
      expect(packages).toContain(graph.get('packageG'));
    });
  });
  describe('The get services method', () => {
    test('should return A, B, C', () => {
      const services = graph.getServices();
      expect(services).toHaveLength(3);
      expect(services).toContain(graph.get('serviceA'));
      expect(services).toContain(graph.get('serviceB'));
      expect(services).toContain(graph.get('serviceC'));
    });
  });
  describe('The bootstrap method', () => {
    let spawn: SinonStub;
    beforeEach(() => {
      spawn = stub(child_process, 'spawn');
    });
    afterEach(() => spawn.restore());
    test('should resolve on close with code 0', async () => {
      const eventEmitter = new EventEmitter();
      setTimeout(() => {
        eventEmitter.emit('close', 0);
      }, 100);
      spawn.returns(eventEmitter as ChildProcess);
      const result = await graph.bootstrap();
      expect(result).toEqual(undefined);
    });
    test('should reject on close with code != 0', async () => {
      const eventEmitter = new EventEmitter();
      setTimeout(() => {
        eventEmitter.emit('close', 1);
      }, 100);
      spawn.returns(eventEmitter as ChildProcess);
      try {
        await graph.bootstrap();
        fail('should fail');
      } catch (e) {
        expect(e).toMatch('Process exited with status 1');
      }
    });
    test('should reject on error', async () => {
      const eventEmitter = new EventEmitter();
      setTimeout(() => eventEmitter.emit('error', new Error('shit happens')), 100);
      spawn.returns(eventEmitter as ChildProcess);
      try {
        await graph.bootstrap();
        fail('should fail');
      } catch (e) {
        expect(e.message).toMatch('shit happens');
      }
    });
  });
  describe('The compile method [given all nodes enabled]', () => {
    let requestCompilation: SinonStub;
    beforeAll(() => {
      requestCompilation = stub(RecompilationScheduler.prototype, 'exec');
      graph.getNodes().forEach((n) => n.enable());
    });
    afterAll(() => {
      requestCompilation.restore();
    });
    beforeEach(() => scheduler.reset());
    test('should compile B, D, E, F, G', async () => {
      await graph.compile(scheduler);
      const compilationQueue = scheduler.getJobs().compile;
      expect(compilationQueue).toHaveLength(5);
      expect(compilationQueue).toContain(graph.get('serviceB'));
      expect(compilationQueue).toContain(graph.get('packageD'));
      expect(compilationQueue).toContain(graph.get('packageE'));
      expect(compilationQueue).toContain(graph.get('packageF'));
      expect(compilationQueue).toContain(graph.get('packageG'));
    });
    test('should compile E before D', async () => {
      await graph.compile(scheduler);
      const compilationQueue = scheduler.getJobs().compile;
      expect(compilationQueue.indexOf(graph.get('packageE'))).toBeLessThan(
        compilationQueue.indexOf(graph.get('packageD')),
      );
    });
    test('should compile D before B', async () => {
      await graph.compile(scheduler);
      const compilationQueue = scheduler.getJobs().compile;
      expect(compilationQueue.indexOf(graph.get('packageD'))).toBeLessThan(
        compilationQueue.indexOf(graph.get('serviceB')),
      );
    });
    test('should compile F before G', async () => {
      await graph.compile(scheduler);
      const compilationQueue = scheduler.getJobs().compile;
      expect(compilationQueue.indexOf(graph.get('packageF'))).toBeLessThan(
        compilationQueue.indexOf(graph.get('packageG')),
      );
    });
  });
  describe('The compile method [given A, B, D, E enabled]', () => {
    test.todo('should compile D, E');
    test.todo('should compile E before D');
  });
  describe('The enable nodes method', () => {
    test.todo('given A enabled, should enable A, D, E');
    test.todo('given B enabled, should enable B, D, E');
    test.todo('given C enabled, should enable C, B, D, E, F, G');
    test.todo('given A, B enabled, should enable A, B, D, E');
    test.todo('given A, C enabled, should enable A, C, B, D, E, F, G');
    test.todo('given B, C enabled, should enable C, B, D, E, F, G');
    test.todo('given A, B, C enabled, should enable A, B, C, B, D, E, F, G');
  });
});
