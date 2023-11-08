import {readFileSync, writeFileSync} from "fs";
import {join} from "path";
import { dump, load } from 'js-yaml';

(async () => {
  try {
    const yarnConfigPath = join(__dirname, '..', '.yarnrc.yml');
    const yarnConfigRaw = readFileSync(yarnConfigPath).toString();

    const yarnConfigParsed = load(yarnConfigRaw) as {
      npmAuthToken: string;
      npmAlwaysAuth: boolean;
      npmScopes: {
        [key: string]: {
          npmAuthToken: string;
          npmAlwaysAuth: boolean;
        }
      }
    };

    const scopesToCover = ['microlambda']

    scopesToCover.forEach((scopeToCover) => {
      yarnConfigParsed.npmScopes[scopeToCover].npmAlwaysAuth = true;
      yarnConfigParsed.npmScopes[scopeToCover].npmAuthToken = process.env.NPM_TOKEN ?? '';
    });

    yarnConfigParsed.npmAlwaysAuth = true;
    yarnConfigParsed.npmAuthToken = process.env.NPM_TOKEN_PLUGIN ?? '';
    writeFileSync(yarnConfigPath, dump(yarnConfigParsed));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
