import { writable } from 'svelte/store';

export const tabMounted = writable<boolean>(false);
