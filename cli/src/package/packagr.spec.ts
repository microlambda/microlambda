import { Packager, Tree } from './packagr';
import { stub, SinonStub } from 'sinon';
import { existsSync } from 'fs';
import { readJSONSync, readFileSync, removeSync } from 'fs-extra';
import { join, relative } from 'path';
import { parse } from 'flatted';
import { ILernaPackage, LernaHelper } from '../utils/lerna';
import { command } from 'execa';
import { sync as glob } from 'glob';

const compareTrees = (received: Tree, expected: Tree) => {
  const expectedRoots = expected.filter((n) => !n.parent);
  const receivedRoots = received.filter((n) => !n.parent);
  const _compareTrees = (_received: Tree, _expected: Tree) => {
    expect(_received.length).toBe(_expected.length);
    for (const node of _received) {
      const matchingNode = _expected.find((n) => n.name === node.name && n.version === node.version);
      expect(matchingNode).toBeTruthy();
      expect(matchingNode.path).toBe(node.path);
      expect(matchingNode.local).toBe(node.local);
      if (node.parent) {
        expect(matchingNode.parent.name).toBe(node.parent.name);
        expect(matchingNode.parent.version).toBe(node.parent.version);
      } else {
        expect(matchingNode.parent).toBeFalsy();
      }
      expect(matchingNode.children.length).toBe(node.children.length);
      if (node.children.length > 0) {
        compareTrees(node.children, matchingNode.children);
      }
    }
  };
  _compareTrees(receivedRoots, expectedRoots);
};

describe('The packager v2', () => {
  let lernaList: SinonStub<[string?], Promise<any>>;
  let lernaListServices: SinonStub<[string?], Promise<any>>;
  let npmList: SinonStub<[string], Promise<any>>;
  const lernaPackages = readJSONSync(join(__dirname, 'mocks', 'lerna-output.json'));
  const toPackage = lernaPackages.find((p: ILernaPackage) => p.name === '@project/categories');
  const prefix = join(__dirname, 'mocks', 'project-mock');
  beforeAll(async () => {
    lernaList = stub(LernaHelper.prototype, 'getAllPackages');
    lernaListServices = stub(LernaHelper.prototype, 'getServices');
    npmList = stub(Packager, 'getDependenciesTreeFromNPM');
    lernaList.resolves(lernaPackages);
    lernaListServices.resolves([
      {
        name: '@project/categories',
        version: '0.0.1',
        private: true,
        location: join(__dirname, 'mocks', 'project-mock', 'services', 'test-package'),
      },
    ]);
    ['categories', 'models', 'middleware', 'permissions', 'shared', 'types'].forEach((name) =>
      npmList
        .withArgs(lernaPackages.find((p: any) => p.name === '@project/' + name).location)
        .resolves(readJSONSync(join(__dirname, 'mocks', name + '.npm-output.json'))),
    );
    await command('unzip project-mock.zip', { cwd: join(__dirname, 'mocks') });
  });
  afterAll(() => {
    lernaList.restore();
    npmList.restore();
    removeSync(prefix);
  });
  it('should correctly build the dependencies tree', async () => {
    const expected: Tree = parse(
      readFileSync(join(__dirname, 'mocks', 'expected-tree.flatted.json')).toString('utf-8'),
    );
    const packager = new Packager();
    const built = await packager.buildDependenciesTree(toPackage);
    compareTrees(built, expected);
  });
  it('should correctly perform tree shaking on dependency tree', () => {
    const expected: Tree = parse(
      readFileSync(join(__dirname, 'mocks', 'expected-shaken-tree.flatted.json')).toString('utf-8'),
    );
    const original: Tree = parse(
      readFileSync(join(__dirname, 'mocks', 'expected-tree.flatted.json')).toString('utf-8'),
    );
    const packager = new Packager();
    packager.setTree('@project/categories', original);
    packager.shake(toPackage);
    compareTrees(packager.getTree('@project/categories'), expected);
  });
  it('should correctly generate zip file', async () => {
    const packager = new Packager(['@project/categories']);
    const tree: Tree = [
      {
        name: '@hapi/joi',
        version: '15.1.1',
        path: join(prefix, 'services', 'test-package', 'node_modules', '@hapi', 'joi'),
        children: [
          {
            name: '@hapi/address',
            version: '15.1.1',
            path: join(
              prefix,
              'services',
              'test-package',
              'node_modules',
              '@hapi',
              'joi',
              'node_modules',
              '@hapi',
              'address',
            ),
            children: [],
            parent: null,
            local: false,
          },
          {
            name: '@hapi/bourne',
            version: '15.1.1',
            path: join(
              prefix,
              'services',
              'test-package',
              'node_modules',
              '@hapi',
              'joi',
              'node_modules',
              '@hapi',
              'bourne',
            ),
            children: [],
            parent: null,
            local: false,
          },
          {
            name: '@hapi/hoek',
            version: '15.1.1',
            path: join(
              prefix,
              'services',
              'test-package',
              'node_modules',
              '@hapi',
              'joi',
              'node_modules',
              '@hapi',
              'hoek',
            ),
            children: [],
            parent: null,
            local: false,
          },
          {
            name: '@hapi/topo',
            version: '15.1.1',
            path: join(
              prefix,
              'services',
              'test-package',
              'node_modules',
              '@hapi',
              'joi',
              'node_modules',
              '@hapi',
              'topo',
            ),
            children: [],
            parent: null,
            local: false,
          },
        ],
        parent: null,
        local: false,
      },
      {
        name: '@project/shared',
        version: '15.1.1',
        path: join(prefix, 'packages', 'shared'),
        children: [
          {
            name: 'uuid',
            version: '15.1.1',
            path: join(prefix, 'packages', 'shared', 'node_modules', 'uuid'),
            children: [],
            parent: null,
            local: true,
          },
        ],
        parent: null,
        local: true,
      },
    ];
    packager.setTree('@project/categories', tree);
    await packager.bundle();
    const archivePath = join(prefix, 'services', 'test-package', '.package');
    expect(existsSync(join(archivePath, 'bundle.zip'))).toBe(true);
    await command('unzip bundle.zip -d bundle', { cwd: archivePath });
    const content = glob(join(archivePath, 'bundle', '**', '*')).map((path) =>
      relative(join(archivePath, 'bundle'), path),
    );
    const expected = readJSONSync(join(__dirname, 'mocks', 'expected-archive-content.json'));
    expect(content.sort()).toEqual(expected.sort());
  });
  it('should throw if service is unknown', async () => {
    const packager = new Packager(['@project/unknown']);
    try {
      await packager.bundle();
      fail('should fail');
    } catch (e) {
      expect(e.message).toBe('E_UNKNOWN_SERVICES');
    }
  });
});
