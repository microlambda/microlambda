import { IConfig } from '../config/config';
import { IGraphElement, LernaGraph } from '../lerna';
import { execCmd } from './child-process';
import { Logger } from './logger';

interface IPackage {
  name: string;
  version: string;
  private: boolean;
  location: string;
}

export const getLernaGraph = async (
  projectRoot: string,
  config: IConfig,
  logger: Logger,
  defaultPort = 3001,
): Promise<LernaGraph> => {
  const packages: IPackage[] = JSON.parse(
    await execCmd('npx', ['lerna', 'la', '--json'], { cwd: projectRoot }, 'debug', 'debug', logger),
  );
  const rawGraph: { [key: string]: string[] } = JSON.parse(
    await execCmd('npx', ['lerna', 'la', '--graph'], { cwd: projectRoot }, 'debug', 'debug', logger),
  );

  const names: Set<string> = new Set(packages.map((p) => p.name));

  const resolvePackage: (name: string) => IGraphElement = (name: string) => {
    const pkg = packages.find((p) => p.name === name);
    const children = rawGraph[name].filter((n) => names.has(n));
    return {
      ...pkg,
      dependencies: children,
    };
  };

  return new LernaGraph(
    Object.keys(rawGraph)
      .filter((n) => names.has(n))
      .map((n) => resolvePackage(n)),
    projectRoot,
    config,
    logger,
    defaultPort,
  );
};
