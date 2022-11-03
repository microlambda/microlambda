import {ICommandResult, IRunCommandErrorEvent} from "./process";

export const isProcessError = (error: unknown): error is ICommandResult => {
  return (error as ICommandResult)?.all != null;
};

export const isNodeEvent = (error: unknown): error is IRunCommandErrorEvent => {
  const candidate = (error as IRunCommandErrorEvent);
  return !!candidate?.type && !!candidate?.error;
}
