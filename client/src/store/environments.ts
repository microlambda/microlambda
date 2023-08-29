import {writable} from "svelte/store";
import type { Writable } from "svelte/store";
import {fetchEnvironments} from "../api";
import type {ICreateWritable} from "../utils/store";
import type {IEnvironment} from "../types/env-var";
import {loadInstances} from "./remote-state";

let selected: IEnvironment | undefined;
let allEnvironments: IEnvironment[] = [];

function createSelectedEnvironmentsStore(): Writable<IEnvironment | undefined> {
  const { subscribe, set, update } = writable<IEnvironment>(undefined);
  return {
    subscribe,
    set,
    update,
  };
}

function createEnvironmentsStore(): ICreateWritable<Array<IEnvironment>> {
  const { subscribe, set, update } = writable<Array<IEnvironment>>([]);
  return {
    subscribe,
    set,
    update,
    fetch: async (): Promise<void> => {
      const response = await fetchEnvironments();
      allEnvironments = response;
      console.debug({allEnvironments});
      set(response);
    },
  };
}

export const environments = createEnvironmentsStore();
export const selectedEnv = createSelectedEnvironmentsStore();

selectedEnv.subscribe((env) => {
  selected = env;
  console.debug('Environment selected', env);
  if (selected) {
    void loadInstances(selected.name);
  }
});

export const selectEnv = (env: string): void => {
  console.debug('Select env', env);
  console.debug({allEnvironments});
  const toSelect = allEnvironments.find((e) => e.name === env);
  console.debug({toSelect})
  selectedEnv.set(toSelect);
};
