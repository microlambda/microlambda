import { centipod as api } from './api/api';
import { centipod as appA } from './apps/app-a';
import { centipod as appB } from './apps/app-b';
import { centipod as workspaceA } from './packages/workspace-a';
import { centipod as workspaceB } from './packages/workspace-b';
import { centipod as workspaceC } from './packages/workspace-c';

export const mockedCentipods = {
  api,
  appA,
  appB,
  workspaceA,
  workspaceB,
  workspaceC,
}
