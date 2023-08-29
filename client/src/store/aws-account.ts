import {derived, writable} from "svelte/store";
import {fetchAwsAccount} from "../api";
import type {ICreateWritable} from "../utils/store";
import type {IAwsAccount} from "../types/env-var";
import {environments} from "./environments";

function createAwsAccountStore(): ICreateWritable<IAwsAccount> {
  const { subscribe, set, update } = writable<IAwsAccount>({ connected: false });
  return {
    subscribe,
    set,
    update,
    fetch: async (): Promise<void> => {
      const response = await fetchAwsAccount();
      set(response);
    },
  };
}

export const awsAccount = createAwsAccountStore();

awsAccount.subscribe((account) => {
  if (account.connected) {
    console.debug('Connected to AWS')
    void environments.fetch();
  }
})
export const awsConnected = derived(awsAccount, ($account) =>
  $account.connected,
);

void awsAccount.fetch();
