<script lang="ts">
  import StatusPill from './StatusPill.svelte';
  import { selected } from '../store';
  import { fade } from 'svelte/transition';
  import { env } from '../env/dev.env';

</script>

<style lang="scss">
  .node-name {
    margin-top: 0;
  }
  .header {
    display: flex;
    flex-direction: row;
    align-items: baseline;
    justify-content: space-between;
  }
</style>
{#if $selected}
<div class="header" transition:fade={{duration: env.transitionDuration}}>
  <h3 class="node-name">{$selected?.name}</h3>
  <div class="statuses">
    <StatusPill size="big" transpiled="{$selected?.transpiled}"/>
    <StatusPill size="big" typeChecked="{$selected?.typeChecked}"/>
    {#if $selected?.port}<StatusPill enabled="{$selected?.enabled}" size="big" serviceStatus="{$selected?.status}"/>{/if}
  </div>
</div>
{/if}
