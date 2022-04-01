<script lang="ts">
  import { slide } from 'svelte/transition';
  import { graph, schedulerStatus, selected } from '../store';
  import type { ServiceStatus } from '@microlambda/types';
  import { stopAll, startAll, restartAll } from '../api';
  import { logger } from '../logger';
  import { onMount } from 'svelte';

  let visible = false;
  let allStarted = false;
  let schedulerBusy = false;

  schedulerStatus.subscribe((status) => {
    schedulerBusy = status === 1;
  })

  onMount(() => {
    schedulerStatus.fetch();
  });

  graph.subscribe((nodes) => {
    allStarted = nodes.filter((n) => n.port && n.enabled).every((n) => n.status === ServiceStatus.STARTING || n.status === ServiceStatus.RUNNING || n.status === ServiceStatus.CRASHED);
    logger.scope('<Header/>').debug('All started', allStarted);
  });

  function toggleMenu() {
    visible = !visible;
  }

  function unselectNode() {
    selected.set(null);
    visible = false;
  }

  function start() {
    if (!schedulerBusy){
      startAll();
      visible = false;
    }
  }

  function stop() {
    if (!schedulerBusy) {
      stopAll();
      visible = false;
    }
  }

  function restart() {
    if (!schedulerBusy) {
      restartAll();
      visible = false;
    }
  }

</script>

<style lang="scss">
  @import '../variables.scss';
  header {
    height: $header_height;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    border-bottom: $header_border solid $anthracite_lighter;
    h1 {
      margin: 0 20px;
    }
    .dots {
      margin: 0 20px;
      cursor: pointer;
    }
  }
  nav {
    position: absolute;
    right: 0;
    background-color: $anthracite;
    border: $header_border solid $anthracite_lighter;

    top: $header_height;
    text-align: right;
    ul {
      padding: 5px 20px;
      margin: 0;
    }
    li {
      padding: 5px 0;
      cursor: pointer;
      &.disabled {
        cursor: not-allowed;
      }
    }
    .separator {
      height: 2px;
      background-color: $anthracite_lighter;
    }
  }
</style>

<header>
  <h1>Microλambda</h1>
  <img on:click={toggleMenu} class="dots" src="ellipsis-v-solid.svg" height="20" width="20"/>
</header>
{#if visible}
<nav transition:slide>
  <ul>
    <li on:click={unselectNode}>Events log</li>
    <div class="separator"></div>
    {#if allStarted}
    <li class:disabled={schedulerBusy} on:click={stop}>Stop project</li>
    <li class:disabled={schedulerBusy} on:click={restart}>Restart project</li>
    {:else }
    <li class:disabled={schedulerBusy} on:click={start}>Start project</li>
    {/if}
  </ul>
</nav>
{/if}
