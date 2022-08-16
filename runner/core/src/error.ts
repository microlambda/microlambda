import {ICommandResult, IRunCommandErrorEvent} from "./process";

export enum CentipodErrorCode {
  NOT_IN_VALID_YARN_PROJECT,
  INVALIDATING_CACHE_FAILED,
  NO_FILES_TO_CACHE,
  MISSING_VERSION,
  CANNOT_PUBLISH_OUTSIDE_PROJECT,
  NO_SEMANTIC_RELEASE_TAGS_FOUND,
  PUBLISHED_WORKSPACE_WITHOUT_BUMP,
  PROJECT_NOT_RESOLVED,
  CANNOT_PUBLISH_PRIVATE_PACKAGE,
  HAS_PRIVATE_DEPENDENCY,
  CANNOT_BUMP_VERSION,
  ALREADY_PUBLISHED,
  FOUND_GREATER_VERSIONS_IN_REGISTRY,
  UNABLE_TO_LOAD_WORKSPACE,
  TAG_AND_REGISTRY_VERSIONS_MISMATCH,
  CANNOT_DETERMINE_BUMP,
  NOTHING_TO_DO,
  BAD_REVISION,
  CACHE_DISABLED
}

export class CentipodError extends Error {
  readonly code: CentipodErrorCode;
  constructor(code: CentipodErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export const isProcessError = (error: unknown): error is ICommandResult => {
  return (error as ICommandResult)?.all != null;
};

export const isNodeEvent = (error: unknown): error is IRunCommandErrorEvent => {
  const candidate = (error as IRunCommandErrorEvent);
  return !!candidate?.type && !!candidate?.error;
}
