import chalk from "chalk";
import Table from "cli-table3";
import {State} from "@microlambda/remote-state";
import {ConfigReader} from "@microlambda/config";
import {resolveProjectRoot} from "@microlambda/utils";
import {logger} from "../utils/logger";

export const printCanaryVersions = async (cmd: {e: string}): Promise<void> => {
  const state = new State(new ConfigReader(resolveProjectRoot()).rootConfig);
  const versions = await state.listVersions(cmd.e);

  logger.lf();
  logger.info(chalk.underline(chalk.bold(`▼ Versions history for ${cmd.e}`)));
  logger.lf();

  const table = new Table({
    head: ['version', 'status', 'createdAt'],
    style: {
      head: ['cyan']
    }
  });
  for (const version of versions.sort((v1, v2) => v2.createdAt.localeCompare(v1.createdAt))) {
    const row = ['v' + version.version, version.active ? 'active' : 'inactive', version.createdAt];
    table.push(row);
  }
  // eslint-disable-next-line no-console
  console.log(table.toString());
}

export const cleanCanaryVersion = async (cmd: {e: string, v: string}): Promise<void> => {

}
