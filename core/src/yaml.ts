/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { dump, load, Schema, Type } from 'js-yaml';
import { copySync, existsSync, readFileSync, removeSync, renameSync, writeFileSync } from 'fs-extra';
import { join, dirname } from 'path';
import { Service } from './graph';
import { ConfigReader } from './config/read-config';
import { compileFile } from './typescript';
import { Logger } from './logger';

class Mapping {
  map: any;
  constructor(map: any) {
    this.map = map;
  }
}

class Sequence {
  values: any[];
  constructor(...args: any[]) {
    this.values = args;
  }
}

class Scalar {
  value: any;
  constructor(value: any) {
    this.value = value;
  }
}

class Base64 extends Scalar {}
class GetAtt extends Scalar {}
class GetAZ extends Scalar {}
class ImportValue extends Scalar {}
class Ref extends Scalar {}
class Sub extends Scalar {}

class Cidr extends Sequence {}
class FindInMap extends Sequence {}
class And extends Sequence {}
class If extends Sequence {}
class Not extends Sequence {}
class Or extends Sequence {}
class Equals extends Sequence {}
class Join extends Sequence {}
class Select extends Sequence {}
class Split extends Sequence {}

class Transform extends Mapping {}

const customTags: Array<{
  name: string;
  kind: 'scalar' | 'sequence' | 'mapping';
  instanceOf: any;
}> = [
  { name: '!Base64', instanceOf: Base64, kind: 'scalar' },
  { name: '!GetAtt', instanceOf: GetAtt, kind: 'scalar' },
  { name: '!GetAZs', instanceOf: GetAZ, kind: 'scalar' },
  { name: '!ImportValue', instanceOf: ImportValue, kind: 'scalar' },
  { name: '!Ref', instanceOf: Ref, kind: 'scalar' },
  { name: '!Sub', instanceOf: Sub, kind: 'scalar' },
  { name: '!Cidr', instanceOf: Cidr, kind: 'sequence' },
  { name: '!FindInMap', instanceOf: FindInMap, kind: 'sequence' },
  { name: '!And', instanceOf: And, kind: 'sequence' },
  { name: '!If', instanceOf: If, kind: 'sequence' },
  { name: '!Not', instanceOf: Not, kind: 'sequence' },
  { name: '!Or', instanceOf: Or, kind: 'sequence' },
  { name: '!Equals', instanceOf: Equals, kind: 'sequence' },
  { name: '!Join', instanceOf: Join, kind: 'sequence' },
  { name: '!Select', instanceOf: Select, kind: 'sequence' },
  { name: '!Split', instanceOf: Split, kind: 'sequence' },
  { name: '!Transform', instanceOf: Transform, kind: 'mapping' },
];

export const CUSTOM_SCHEMA = Schema.create(
  customTags.map(
    (tag) =>
      new Type(tag.name, {
        kind: tag.kind,
        construct: (data) => {
          return new tag.instanceOf(data);
        },
        instanceOf: tag.instanceOf,
        represent: (object: any) => {
          switch (tag.kind) {
            case 'mapping':
              return { ...object.map };
            case 'scalar':
              return object.value;
            case 'sequence':
              return [...object.values];
          }
        },
      }),
  ),
);

export const parseServerlessYaml = (path: string) => {
  return load(readFileSync(path).toString(), {
    schema: CUSTOM_SCHEMA,
  });
};

const getServerlessPath = (service: Service): { src: string; dest: string } => {
  const basePath = service.getLocation();
  const src = join(basePath, 'serverless.yml');
  const dest = join(basePath, 'serverless.yml.backup');
  return { src, dest };
};

export const backupYaml = (services: Service[]): void => {
  services.forEach((service) => {
    const { src, dest } = getServerlessPath(service);
    try {
      renameSync(src, dest);
    } catch (e) {
      if (!existsSync(dest)) {
        throw e;
      }
    }
  });
};

export const restoreYaml = (services: Service[]): void => {
  services.forEach((service) => {
    const { src, dest } = getServerlessPath(service);
    if (existsSync(src)) {
      removeSync(src);
    }
    copySync(dest, src);
  });
};

const removePlugins = (doc: any): void => {
  const removePlugins = ['serverless-offline', 'serverless-webpack'];
  if (doc.plugins) {
    doc.plugins = doc.plugins.filter((p: string) => !removePlugins.includes(p));
  }
};

const overwriteRegion = (doc: any, region: string): void => {
  doc.provider.region = region;
};

const optionalRegion = (doc: any, region: string): void => {
  const toDelete = [];
  for (const functionName of Object.keys(doc.functions)) {
    const functionDef = doc.functions[functionName];
    if (functionDef.region && functionDef.region !== region) {
      toDelete.push(functionName);
    }
  }
  toDelete.forEach((name) => delete doc.functions[name]);
};

export const reformatYaml = async (
  projectRoot: string,
  config: ConfigReader,
  services: Service[],
  region: string,
  env: string,
): Promise<void> => {
  for (const service of services) {
    const { src, dest } = getServerlessPath(service);
    const doc = load(readFileSync(dest, 'utf8'), {
      schema: CUSTOM_SCHEMA,
    });
    const scripts = config.getYamlTransformations(projectRoot);
    for (const script of scripts) {
      if (!existsSync(script)) {
        throw Error(`YAML Transforms: Script ${script} does not exists`);
      }
      let path: string;
      if (script.match(/\.ts$/)) {
        await compileFile(dirname(script), script, { outDir: dirname(script) }, new Logger());
        path = script.replace(/\.ts$/, '.js');
      } else if (script.match(/\.js$/)) {
        path = script;
      } else {
        throw Error(`YAML Transforms: Script ${script} has invalid extension: not {js, ts}`);
      }
      if (!existsSync(path)) {
        throw Error(`YAML Transforms: Script ${path} does not exists`);
      }
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const transformation: { default: (...args: unknown[]) => void } = require(path);
      if (typeof transformation.default !== 'function') {
        throw Error(`YAML Transforms: Default export of script must be a function @ ${script}`);
      }
      transformation.default(doc, region, env);
    }
    overwriteRegion(doc, region);
    removePlugins(doc);
    optionalRegion(doc, region);
    writeFileSync(
      src,
      dump(doc, {
        schema: CUSTOM_SCHEMA,
      }),
    );
  }
};

export const getServiceName = (service: Service): string => {
  const path = join(service.getLocation(), 'serverless.yml');
  if (!existsSync(path)) {
    throw Error('Error: serverless.yml not found @ ' + path);
  }
  const yaml = parseServerlessYaml(path);
  return yaml.service;
};
