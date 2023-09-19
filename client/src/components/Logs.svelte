<script lang="ts">
  import Convert from 'ansi-to-html';
  import { afterUpdate, createEventDispatcher, onMount } from 'svelte';
  import { VirtualScroll } from "svelte-virtual-scroll-list";
  import Button from "./Button.svelte";
  export let logs: Array<{id: number, text: string }> = [];
  const fromAnsi = new Convert();
  export let height = 500;
  export let width = 500;

  let autoScrollEnabled = true;
  let div, container: HTMLElement;
  let list: VirtualScroll;
  const dispatch = createEventDispatcher();

  const autoScroll = () => {
    if (list) {
      list.scrollToBottom();
    }
  }

  afterUpdate(() => {
    if (autoScrollEnabled) {
      autoScroll();
    }
  });

  onMount(() => {
    autoScroll();
    dispatch('mounted', container);
  });

  const scrolledToTop = () => {
    console.debug('TOP');
  }

  const scrolledToBottom = () => {
    console.debug('BOTTOM');
  }

</script>

<style lang="scss">
  @import '../variables';
  #logs--controls {
    padding-bottom: 10px;
    label {
      font-size: 10pt;
    }
  }
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
    margin: 0;
  }
</style>

<div id="logs--controls">
  <Button on:click={() => list.scrollToBottom()}>Scroll to bottom</Button>
  <Button on:click={() => list.scrollToOffset(0)}>Scroll to top</Button>
  <input bind:checked={autoScrollEnabled} type="checkbox" id="auto-scroll"/>
  <label for="auto-scroll">Automatically scroll when receiving new logs</label>
</div>

<div class="wrapper" bind:this={container} style="{`height: ${height}px;`}">
  <div class="scrollable" bind:this={div}>
    {#if logs && logs.length && Array.isArray(logs)}
      <VirtualScroll
        bind:this={list}
        data={logs}
        key="id"
        keeps="200"
        let:data
        on:bottom={() => scrolledToBottom()}
        on:top={() => scrolledToTop()}
      >
        <pre>{ @html fromAnsi.toHtml(data.text) }</pre>
      </VirtualScroll>
    {:else }
    <pre>No logs to show ¯\_(ツ)_/¯</pre>
    {/if}
  </div>
</div>
