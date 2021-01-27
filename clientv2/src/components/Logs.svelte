<script lang="ts">
  import * as ansi from 'ansi-html';
  import { afterUpdate, createEventDispatcher, onMount } from 'svelte';
  export let logs: string[] = [];
  const fromAnsi = ansi.default;
  export let height = 500;
  export let width = 500;

  let div, container: HTMLElement;
  const dispatch = createEventDispatcher();

  const autoScroll = () => {
    if (div) {
      div.scrollTo(0, div.scrollHeight);
    }
  }

  afterUpdate(() => {
    autoScroll();
  });

  onMount(() => {
    autoScroll();
    dispatch('mounted', container);
  });

</script>

<style lang="scss">
  @import '../variables';
  .wrapper {
    background-color: $anthracite;
    border-radius: 5px;
  }
  .scrollable {
    overflow-x: auto;
    overflow-y: auto;
    height: 100%;
  }
  pre {
    font-family: "Roboto Mono", monospace;
    font-size: 9pt;
  }
</style>

<div class="wrapper" bind:this={container} style="{`height: ${height}px; width: ${width}px`}">
  <div class="scrollable" bind:this={div}>
    {#if logs.length}
    <pre>{ @html fromAnsi(logs.join('')) }</pre>
    {:else }
    <pre>No logs to show ¯\_(ツ)_/¯</pre>
    {/if}
  </div>
</div>
