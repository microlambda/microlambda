export enum MilaErrorCode {
  NOT_IN_VALID_YARN_PROJECT = 'MILA0001',
  INVALIDATING_CACHE_FAILED = 'MILA0002',
  NO_FILES_TO_CACHE = 'MILA0003',
  MISSING_VERSION = 'MILA0004',
  CANNOT_PUBLISH_OUTSIDE_PROJECT = 'MILA0005',
  NO_SEMANTIC_RELEASE_TAGS_FOUND = 'MILA0006',
  PUBLISHED_WORKSPACE_WITHOUT_BUMP = 'MILA0007',
  PROJECT_NOT_RESOLVED = 'MILA0008',
  CANNOT_PUBLISH_PRIVATE_PACKAGE = 'MILA0009',
  HAS_PRIVATE_DEPENDENCY = 'MILA0010',
  CANNOT_BUMP_VERSION = 'MILA0011',
  ALREADY_PUBLISHED = 'MILA0012',
  FOUND_GREATER_VERSIONS_IN_REGISTRY = 'MILA0013',
  UNABLE_TO_LOAD_WORKSPACE = 'MILA0014',
  TAG_AND_REGISTRY_VERSIONS_MISMATCH = 'MILA0015',
  CANNOT_DETERMINE_BUMP = 'MILA0016',
  NOTHING_TO_DO = 'MILA0017',
  BAD_REVISION = 'MILA0018',
  CACHE_DISABLED = 'MILA0019',
  ROOT_CONFIG_NOT_FOUND = 'MILA0020',
  ILL_FORMED_ROOT_CONFIG = 'MILA0021',
  INVALID_ROOT_CONFIG = 'MILA0022',
  ILL_FORMED_PACKAGE_CONFIG = 'MILA0023',
  INVALID_PACKAGE_CONFIG = 'MILA0024',
}
