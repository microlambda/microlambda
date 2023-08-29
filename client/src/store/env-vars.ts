import {writable} from "svelte/store";
import type {ICreateWritable} from "../utils/store";
import type {ILoadedEnvironmentVariable} from "../types/env-var";
import {fetchServiceEnvironment} from "../api";

const cache = new Map<string, Array<ILoadedEnvironmentVariable>>();
let currentRequest: string | undefined;
export const loadingServiceEnvironment = writable<boolean>(false);

function createServicesEnvironmentStore(): ICreateWritable<Array<ILoadedEnvironmentVariable>, { service: string, env: string}> {
  const { subscribe, set, update } = writable<Array<ILoadedEnvironmentVariable>>([]);
  return {
    subscribe,
    set,
    update,
    fetch: async ({env, service}): Promise<void> => {
      const key = `${service}|${env}`;
      const cached = cache.get(key);
      if (cached) {
        loadingServiceEnvironment.set(false);
        set(cached);
      } else {
        const response = await fetchServiceEnvironment(service, env);
        cache.set(key, response);
        if (currentRequest === key) {
          loadingServiceEnvironment.set(false);
          set(response);
        }
      }
    },
  };
}


export const serviceEnvironment = createServicesEnvironmentStore();

export const loadServiceEnvironment = async (env: string, service: string): Promise<void> => {
  loadingServiceEnvironment.set(true);
  serviceEnvironment.set([]);
  currentRequest = `${service}|${env}`;
  await serviceEnvironment.fetch({env, service});
};
