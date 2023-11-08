<script lang="ts">
    import type {ILoadedEnvironmentVariable} from "../types/env-var";

    export let variable: ILoadedEnvironmentVariable = { key: '', value: '', from: '' };

    let isMasked = true;

    $: secretValue = isMasked ? getMaskedValue() : variable.value;
    $: buttonLabel = isMasked ? 'reveal' : 'hide';

    function toggle(): void {
      isMasked = !isMasked;
    }

    function getMaskedValue(): string {
      const stars = (len: number): string => {
        let x = '';
        for (let i = 0; i<len;++i) x += '*';
        return x;
      }
      if (variable.value?.length > 4) {
        const twoFirst = variable.value?.slice(0, 2);
        const twoLast = variable.value?.slice(variable.value?.length - 2, variable.value?.length);
        return twoFirst + stars(variable.value?.length - 4) + twoLast;
      }
      return stars(variable.value?.length ?? 0);
    }
</script>

<style lang="scss">
span {
  font-family: "Roboto Mono", monospace;
}

</style>
{#if variable.raw}
    <span>
        {secretValue}
        <button on:click={toggle}>{buttonLabel}</button>
    </span>
{:else}
    <span>
        {variable.value}
    </span>
{/if}
