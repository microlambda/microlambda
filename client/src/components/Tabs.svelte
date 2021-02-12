<script lang="ts">
  import { fade } from 'svelte/transition';
  import { onDestroy, onMount } from 'svelte';
  import { calculateDimensions } from '../utils/window-dimensions.utils';
  import { tabMounted } from '../store';
  import { logger } from '../logger';
  import { env } from '../env/dev.env';

  export interface ITab {
    title: string;
    component: any;
  }
  export let tabs: ITab[] = [];
  export let selectedTab: ITab = tabs[0];

  let height = 0;
  let container: HTMLElement;
  const paddingBottom = 75;
  const log = logger.scope('<Tabs/>');

  const fitToWindow = () => {
    // Wait for sibling DOM event to be mounted
    setTimeout(() => {
      const dimensions = calculateDimensions(container);
      height = dimensions.height - paddingBottom;
    }, 0);
  }

  onMount(() => {
    log.debug('Tab mounted');
    fitToWindow();
    // Workaround
    setTimeout(() => tabMounted.set(true), 200);
  });

  onDestroy(() => {
    log.debug('Tab destroyed');
    tabMounted.set(false);
  });

  window.onresize = fitToWindow;

  function updateSelectedTab(tab: ITab) {
    selectedTab = tab;
  }
</script>

<style lang="scss">
  @import '../variables.scss';
  .tabs-header {
    ul {
      display: flex;
      flex-direction: row;
      margin: 0;
      li {
        padding: 10px 30px;
        font-size: 13px;
        cursor: pointer;
        background-color: $anthracite;
        border-radius: 10px 10px 0 0;
        border: 1px solid rgba(255, 255, 255, 0.5);
        border-bottom: 0;
        &.active {
          background-color: $anthracite_lighter;
        }
      }
    }
  }
  #tab-content {
    background-color: $anthracite;
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 0 10px 10px 10px;
    padding: 20px;
  }
</style>

<div class="tabs">
  <div class="tabs-header">
    <ul>
      {#each tabs as tab}<li class:active={selectedTab === tab} on:click={updateSelectedTab(tab)}>{tab.name}</li>{/each}
    </ul>
  </div>
  <div id="tab-content" bind:this={container} style="{'height: ' + height + 'px;'}">
    {#each tabs as tab}
      {#if selectedTab === tab}<div transition:fade={{duration: env.transitionDuration}}><svelte:component this={selectedTab.component} /></div>{/if}
    {/each}
  </div>
</div>
