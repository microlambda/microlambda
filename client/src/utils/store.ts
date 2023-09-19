import type { Writable } from "svelte/store";

export interface ICreateWritable<T, A = void> extends Writable<T> {
  fetch: (args: A) => Promise<void>;
}
