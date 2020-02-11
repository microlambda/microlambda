import { execSync } from 'child_process';
import { IGraphElement } from './lerna-node';
import { LernaGraph } from './lerna-graph';
import { IConfig } from '../config/config';

interface IPackage {
  name: string;
  version: string;
  private: boolean;
  location: string;
}


export const getLernaGraph = (projectRoot: string, config: IConfig, defaultPort = 3001) => {
  const packages: IPackage[] = JSON.parse(execSync('npx lerna la --json', {cwd: projectRoot}).toString());
  const rawGraph: {[key: string]: string[]} = JSON.parse(execSync('npx lerna la --graph', { cwd: projectRoot}).toString());

  const names: Set<string> = new Set(packages.map(p => p.name));

  const resolvePackage: (name: string) =>  IGraphElement = (name: string) => {
    const pkg = packages.find(p => p.name === name);
    const children = rawGraph[name].filter(n => names.has(n));
    return {
      ...pkg,
      dependencies: children.map(n => resolvePackage(n)),
    }
  };

  return new LernaGraph(
    Object.keys(rawGraph).filter(n => names.has(n)).map(n => resolvePackage(n)),
    projectRoot,
    config,
    defaultPort,
  );
};
