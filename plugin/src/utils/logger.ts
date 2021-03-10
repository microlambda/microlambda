import { ILogger, ServerlessInstance } from "../types";
import chalk from "chalk";
import { stringify } from "./stringify";

export const createLogger = (
  serverless: ServerlessInstance,
  pluginName: string
): ILogger => ({
  debug: (...args: unknown[]): void => {
    if (process.env.SLS_DEBUG) {
      serverless.cli.log(
        `${chalk.cyan("[debug]")}  ${args.map((a) => stringify(a)).join(" ")}`,
        pluginName
      );
    }
  },
  info: (...args: any[]): void => {
    serverless.cli.log(
      `${chalk.blue("[info]")}  ${args.map((a) => stringify(a)).join(" ")}`,
      pluginName
    );
  },
  warn: (...args: any[]): void => {
    serverless.cli.log(
      `${chalk.yellow("[warn]")}  ${args.map((a) => stringify(a)).join(" ")}`,
      pluginName
    );
  },
  error: (...args: unknown[]): void => {
    serverless.cli.log(
      `${chalk.red("[error]")}  ${args.map((a) => stringify(a)).join(" ")}`,
      pluginName
    );
  },
});
