import { IGraphElement } from '../../src/lerna';

export const graph1: IGraphElement[] = [
  {
    name: 'serviceA',
    version: '0.0.1',
    private: true,
    location: 'path/to/service',
    dependencies: ['packageD'],
  },
  {
    name: 'serviceB',
    version: '0.0.1',
    private: true,
    location: 'path/to/service',
    dependencies: ['packageD'],
  },
  {
    name: 'serviceC',
    version: '0.0.1',
    private: true,
    location: 'path/to/service',
    dependencies: ['serviceB', 'packageF', 'packageG', 'packageE'],
  },
  {
    name: 'packageD',
    version: '0.0.1',
    private: true,
    location: 'path/to/package',
    dependencies: ['packageE'],
  },
  {
    name: 'packageE',
    version: '0.0.1',
    private: true,
    location: 'path/to/package',
    dependencies: [],
  },
  {
    name: 'packageF',
    version: '0.0.1',
    private: true,
    location: 'path/to/package',
    dependencies: [],
  },
  {
    name: 'packageG',
    version: '0.0.1',
    private: true,
    location: 'path/to/package',
    dependencies: ['packageF'],
  },
];
