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
import { SinonStub, stub } from 'sinon';
import { EventEmitter } from 'events';
import child_process, { ChildProcess } from 'child_process';
import { generateGraph } from '../../mocks/graph-1';
import fs from 'fs';

const graph: LernaGraph = generateGraph();
let existsSync: SinonStub;

describe('The LernaGraph class', () => {
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
      const otherGraph = generateGraph({ compilationMode: 'eager', ports: {}, noStart: [] }, 4800);
      expect(otherGraph.getPort('serviceA')).toBe(4800);
      expect(otherGraph.getPort('serviceB')).toBe(4801);
      expect(otherGraph.getPort('serviceC')).toBe(4802);
    });
  });
  describe('The get packages method', () => {
    beforeAll(() => {
      existsSync = stub(fs, 'existsSync');
      existsSync.withArgs('path/to/service/serverless.yml').returns(true);
      existsSync.withArgs('path/to/package/serverless.yml').returns(false);
    });
    afterAll(() => existsSync.restore());
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
    beforeAll(() => {
      existsSync = stub(fs, 'existsSync');
      existsSync.withArgs('path/to/service/serverless.yml').returns(true);
      existsSync.withArgs('path/to/package/serverless.yml').returns(false);
    });
    afterAll(() => existsSync.restore());
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
  describe('The enable nodes method', () => {
    beforeEach(() => {
      graph.getNodes().forEach((n) => n.disable());
    });
    test('given A enabled, should enable A, D, E', () => {
      graph.get('serviceA').enable();
      graph.enableNodes();
      expect(graph.get('serviceA').isEnabled()).toBe(true);
      expect(graph.get('packageD').isEnabled()).toBe(true);
      expect(graph.get('packageE').isEnabled()).toBe(true);
    });
    test('given B enabled, should enable B, D, E', () => {
      graph.get('serviceB').enable();
      graph.enableNodes();
      expect(graph.get('serviceB').isEnabled()).toBe(true);
      expect(graph.get('packageD').isEnabled()).toBe(true);
      expect(graph.get('packageE').isEnabled()).toBe(true);
    });
    test('given C enabled, should enable C, B, D, E, F, G', () => {
      graph.get('serviceC').enable();
      graph.enableNodes();
      expect(graph.get('serviceC').isEnabled()).toBe(true);
      expect(graph.get('serviceB').isEnabled()).toBe(true);
      expect(graph.get('packageD').isEnabled()).toBe(true);
      expect(graph.get('packageE').isEnabled()).toBe(true);
      expect(graph.get('packageF').isEnabled()).toBe(true);
      expect(graph.get('packageG').isEnabled()).toBe(true);
    });
    test('given A, B enabled, should enable A, B, D, E', () => {
      graph.get('serviceA').enable();
      graph.get('serviceB').enable();
      graph.enableNodes();
      expect(graph.get('serviceA').isEnabled()).toBe(true);
      expect(graph.get('serviceB').isEnabled()).toBe(true);
      expect(graph.get('packageD').isEnabled()).toBe(true);
      expect(graph.get('packageE').isEnabled()).toBe(true);
    });
    test('given A, C enabled, should enable A, C, B, D, E, F, G', () => {
      graph.get('serviceA').enable();
      graph.get('serviceC').enable();
      graph.enableNodes();
      expect(graph.get('serviceA').isEnabled()).toBe(true);
      expect(graph.get('serviceC').isEnabled()).toBe(true);
      expect(graph.get('serviceB').isEnabled()).toBe(true);
      expect(graph.get('packageD').isEnabled()).toBe(true);
      expect(graph.get('packageE').isEnabled()).toBe(true);
      expect(graph.get('packageF').isEnabled()).toBe(true);
      expect(graph.get('packageG').isEnabled()).toBe(true);
    });
    test('given B, C enabled, should enable C, B, D, E, F, G', () => {
      graph.get('serviceB').enable();
      graph.get('serviceC').enable();
      graph.enableNodes();
      expect(graph.get('serviceC').isEnabled()).toBe(true);
      expect(graph.get('serviceB').isEnabled()).toBe(true);
      expect(graph.get('packageD').isEnabled()).toBe(true);
      expect(graph.get('packageE').isEnabled()).toBe(true);
      expect(graph.get('packageF').isEnabled()).toBe(true);
      expect(graph.get('packageG').isEnabled()).toBe(true);
    });
    test('given A, B, C enabled, should enable A, B, C, D, E, F, G', () => {
      graph.get('serviceA').enable();
      graph.get('serviceB').enable();
      graph.get('serviceC').enable();
      graph.enableNodes();
      expect(graph.get('serviceA').isEnabled()).toBe(true);
      expect(graph.get('serviceB').isEnabled()).toBe(true);
      expect(graph.get('serviceC').isEnabled()).toBe(true);
      expect(graph.get('packageD').isEnabled()).toBe(true);
      expect(graph.get('packageE').isEnabled()).toBe(true);
      expect(graph.get('packageF').isEnabled()).toBe(true);
      expect(graph.get('packageG').isEnabled()).toBe(true);
    });
  });
});
