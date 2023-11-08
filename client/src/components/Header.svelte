<script lang="ts">
  import { slide } from 'svelte/transition';
  import {graph, selectEnv, selectWorkspace} from '../store';
  import { stopAll, startAll, restartAll } from '../api';
  import { logger } from '../logger';

  let visible = false;
  let allStarted = false;
  let schedulerBusy = false;

  graph.subscribe((nodes) => {
    allStarted = nodes.services?.every((n) => n.status === 0 || n.status === 1 || n.status === 4);
    logger.scope('<Header/>').debug('All started', allStarted);
  });

  function toggleMenu() {
    visible = !visible;
  }

  function unselectNode() {
    selectWorkspace();
    selectEnv();
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
      cursor: pointer;
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
  <h1 on:click={unselectNode}>Microλambda</h1>
  <img alt="menu" on:click={toggleMenu} class="dots" src="ellipsis-v-solid.svg" height="20" width="20"/>
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
