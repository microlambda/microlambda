import { SinonStub, stub } from 'sinon';
import { RecompilationScheduler } from '../../../src/utils/scheduler';
import { LernaGraph, LernaNode, Service } from '../../../src/lerna';
import { generateGraph } from '../../mocks/graph-1';
import { compiledNode, startedService } from '../../mocks/reactive-tasks';
import fs from 'fs';

const scheduler = new RecompilationScheduler();
let compileNode: SinonStub;
let startService: SinonStub;
let existsSync: SinonStub;
const graph: LernaGraph = generateGraph();

describe('The RecompilationScheduler', () => {
  beforeAll(() => {
    existsSync = stub(fs, 'existsSync');
    existsSync.withArgs('path/to/service/serverless.yml').returns(true);
    existsSync.withArgs('path/to/package/serverless.yml').returns(false);
  });
  afterAll(() => {
    existsSync.restore();
  });
  describe('The start project method', () => {
    describe('The start project method [given all nodes enabled]', () => {
      beforeAll(async () => {
        compileNode = stub(LernaNode.prototype, 'compileNode');
        compileNode.returns(compiledNode(graph.get('packageG')));
        startService = stub(Service.prototype, 'start');
        startService.returns(startedService(graph.get('serviceA') as Service));
        graph.getNodes().forEach((n) => n.enable());
        await scheduler.startProject(graph, true);
      });
      afterAll(() => {
        graph.getNodes().forEach((n) => n.disable());
        compileNode.restore();
        startService.restore();
      });
      test('should compile B, D, E, F, G', async () => {
        expect(compileNode.callCount).toBe(5);
        const calls = compileNode.getCalls();
        const nodesCompiled = calls.map((c) => c.thisValue);
        expect(nodesCompiled).toContain(graph.get('serviceB'));
        expect(nodesCompiled).toContain(graph.get('packageD'));
        expect(nodesCompiled).toContain(graph.get('packageE'));
        expect(nodesCompiled).toContain(graph.get('packageF'));
        expect(nodesCompiled).toContain(graph.get('packageG'));
      });
      test('should compile E before D', async () => {
        const compileE = compileNode.getCalls().find((c) => c.thisValue === graph.get('packageE'));
        const compileD = compileNode.getCalls().find((c) => c.thisValue === graph.get('packageD'));
        expect(compileE.calledBefore(compileD)).toBe(true);
      });
      test('should compile D before B', async () => {
        const compileB = compileNode.getCalls().find((c) => c.thisValue === graph.get('serviceB'));
        const compileD = compileNode.getCalls().find((c) => c.thisValue === graph.get('packageD'));
        expect(compileB.calledAfter(compileD)).toBe(true);
      });
      test('should compile F before G', async () => {
        const compileF = compileNode.getCalls().find((c) => c.thisValue === graph.get('packageF'));
        const compileG = compileNode.getCalls().find((c) => c.thisValue === graph.get('packageG'));
        expect(compileF.calledBefore(compileG)).toBe(true);
      });
    });
    describe('The start project method [given A, B, D, E enabled]', () => {
      beforeAll(async () => {
        compileNode = stub(LernaNode.prototype, 'compileNode');
        compileNode.returns(compiledNode(graph.get('packageG')));
        startService = stub(Service.prototype, 'start');
        startService.returns(startedService(graph.get('serviceA') as Service));
        graph.getNodes().forEach((n) => n.disable());
        graph.get('serviceA').enable();
        graph.get('serviceB').enable();
        graph.get('packageD').enable();
        graph.get('packageE').enable();
        await scheduler.startProject(graph, true);
      });
      afterAll(() => {
        graph.getNodes().forEach((n) => n.disable());
        compileNode.restore();
        startService.restore();
      });
      test('should compile D, E', async () => {
        expect(compileNode.callCount).toBe(2);
        const calls = compileNode.getCalls();
        const nodesCompiled = calls.map((c) => c.thisValue);
        expect(nodesCompiled).toContain(graph.get('packageD'));
        expect(nodesCompiled).toContain(graph.get('packageE'));
      });
      test('should compile E before D', async () => {
        const compileE = compileNode.getCalls().find((c) => c.thisValue === graph.get('packageE'));
        const compileD = compileNode.getCalls().find((c) => c.thisValue === graph.get('packageD'));
        expect(compileE.calledBefore(compileD)).toBe(true);
      });
    });
  });
});
