/* eslint-disable no-console */
import { join } from 'path';
import { readFileSync, existsSync, removeSync, renameSync, writeFileSync } from 'fs-extra';
import { dump, load } from 'js-yaml';
import { CUSTOM_SCHEMA } from '../../utils/yaml';

export const getPath = (service: string): string => {
  const serviceName = service.match(/^@dataportal\/(.+)$/)[1];
  return join('services', serviceName);
};

const getServerlessPath = (service: string): { src: string; dest: string } => {
  const basePath = getPath(service);
  const src = join(basePath, 'serverless.yml');
  const dest = join(basePath, 'serverless.yml.backup');
  return { src, dest };
};

export const backupYaml = (services: string[]): void => {
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

export const restoreYaml = (services: string[]): void => {
  services.forEach((service) => {
    const { src, dest } = getServerlessPath(service);
    removeSync(src);
    renameSync(dest, src);
  });
};

export const reformatYaml = (services: string[], region: string, env: string): void => {
  services.forEach((service) => {
    const { src, dest } = getServerlessPath(service);
    console.log('Reformatting', src);
    const doc = load(readFileSync(dest, 'utf8'), {
      schema: CUSTOM_SCHEMA,
    });
    const toDelete = [];
    for (const functionName of Object.keys(doc.functions)) {
      const functionDef = doc.functions[functionName];
      if (functionDef.region && functionDef.region !== region) {
        toDelete.push(functionName);
      } else if (doc.functions[functionName].events) {
        for (const trigger of doc.functions[functionName].events) {
          if (trigger.http && trigger.http.authorizer && trigger.http.authorizer.name === 'auth') {
            delete trigger.http.authorizer.name;
            trigger.http.authorizer.arn = `arn:aws:lambda:${region}:624074376577:function:dataportal-auth-${env}-auth`;
          }
        }
      }
    }
    toDelete.forEach((name) => delete doc.functions[name]);
    const removePlugins = ['serverless-offline', 'serverless-webpack'];
    if (doc.plugins) {
      doc.plugins = doc.plugins.filter((p: string) => !removePlugins.includes(p));
    }
    writeFileSync(
      src,
      dump(doc, {
        schema: CUSTOM_SCHEMA,
      }),
    );
  });
};
