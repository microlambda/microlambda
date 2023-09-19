import { writable } from 'svelte/store';
import { fetchServicesInstance } from '../api';
import type { ICreateWritable } from '../utils/store';
import type { IServiceInstance } from '../types/env-var';

const cache = new Map<string, Array<IServiceInstance>>();

function createServicesInstancesStore(): ICreateWritable<
  Array<IServiceInstance>,
  string
> {
  const { subscribe, set, update } = writable<Array<IServiceInstance>>([]);
  return {
    subscribe,
    set,
    update,
    fetch: async (env: string): Promise<void> => {
      const cached = cache.get(env);
      if (cached) {
        set(cached);
      } else {
        const response = await fetchServicesInstance(env);
        cache.set(env, response);
        set(response);
      }
    },
  };
}

export const loadingInstances = writable<boolean>(true);

export const servicesInstances = createServicesInstancesStore();

export const loadInstances = async (env?: string): Promise<void> => {
  servicesInstances.set([]);
  loadingInstances.set(true);
  if (env) {
    await servicesInstances.fetch(env);
  }
  loadingInstances.set(false);
};
