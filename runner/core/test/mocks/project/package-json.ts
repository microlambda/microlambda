import { pkg as api } from './api/api';
import { pkg as appA } from './apps/app-a';
import { pkg as appB } from './apps/app-b';
import { pkg as workspaceA } from './packages/workspace-a';
import { pkg as workspaceB } from './packages/workspace-b';
import { pkg as workspaceC } from './packages/workspace-c';

const rootPackage = {
  name: "test-project",
  version: "2.0.9",
  workspaces: [
    "packages/*",
    "api",
    "apps/*"
  ],
  description: "Mocked project used for unit testing",
  author: "Mario Arnautou",
  license: "MIT"
};

export const mockedPackages = {
  root: rootPackage,
  workspaces: {
    api,
    appA,
    appB,
    workspaceA,
    workspaceB,
    workspaceC,
  }
}
