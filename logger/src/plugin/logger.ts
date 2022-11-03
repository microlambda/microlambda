import { IBaseLogger, ServerlessInstance } from "@microlambda/types";
import chalk from "chalk";
import { stringify } from "../stringify";

export class PluginLogger implements IBaseLogger {
  constructor(
    readonly serverless: ServerlessInstance,
    readonly pluginName: string
  ) {}

  debug(...args: unknown[]): void {
    if (process.env.SLS_DEBUG) {
      this.serverless.cli.log(
        `${chalk.cyan("[debug]")}  ${args.map((a) => stringify(a)).join(" ")}`,
        this.pluginName
      );
    }
  }

  error(...args: unknown[]): void {
    this.serverless.cli.log(
      `${chalk.red("[error]")}  ${args.map((a) => stringify(a)).join(" ")}`,
      this.pluginName
    );
  }

  info(...args: unknown[]): void {
    this.serverless.cli.log(
      `${chalk.blue("[info]")}  ${args.map((a) => stringify(a)).join(" ")}`,
      this.pluginName
    );
  }

  warn(...args: unknown[]): void {
    this.serverless.cli.log(
      `${chalk.yellow("[warn]")}  ${args.map((a) => stringify(a)).join(" ")}`,
      this.pluginName
    );
  }
}
