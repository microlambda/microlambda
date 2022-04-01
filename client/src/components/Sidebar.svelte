<script lang='ts'>
  import { onMount } from 'svelte';

  import { services, packages, graph, selected } from '../store';
  import StatusPill from './StatusPill.svelte';

  onMount(() => {
    graph.fetch();
  });

  const selectService = (node: any) => {
    selected.set(node);
  }
</script>

<style lang='scss'>
  aside {
    padding: 20px 20px 30px;
  }
  .sidebar-content {
    overflow-y: auto;
    padding: 10px;
    height: 100%;
  }
  .mt0 {
    margin-top: 0;
  }
  li {
    font-size: 10.5pt;
    cursor: pointer;
    display: flex;
    flex-direction: row;
    align-items: center;
    white-space: nowrap;
    margin: 4px 0;
    &:hover {
      font-weight: 800;
    }
    span {
      margin-left: 5px;
    }
  }
  /*.clickable {
    cursor: pointer;
  }*/
</style>

<aside>
  <div class="sidebar-content">
    {#if $services.length}<h3 class="mt0">Services</h3>
    <ul>
      {#each $services as node}
        <li on:click={selectService(node)}>
          <StatusPill transpiled="{node.transpiled}"/>
          <StatusPill typeChecked="{node.typeChecked}"/>
          <StatusPill enabled="{node.enabled}" serviceStatus="{node.status}"/>
          <span>{node.name}</span>
        </li>
      {/each}
    </ul>{/if}
    {#if $packages.length}<h3>Packages</h3>
    <ul>
      {#each $packages as node}
        <li on:click={selectService(node)}>
          <StatusPill transpiled="{node.transpiled}"/>
          <StatusPill typeChecked="{node.typeChecked}"/>
          <span>{node.name}</span>
        </li>
      {/each}
    </ul>{/if}
  </div>
</aside>
