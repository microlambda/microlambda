<script lang="ts">
  import * as ansi from 'ansi-html';
  import NodeInfos from './NodeInfos.svelte';
  import NodeActions from './NodeActions.svelte';
  import type { INodeSummary } from '@microlambda/types';
  import NodeHeader from './NodeHeader.svelte';
  import BuildLogs from './BuildLogs.svelte';
  import ServiceLogs from './ServiceLogs.svelte';
  import DependenciesGraph from './DependenciesGraph.svelte';
  import type ITab from './Tabs.svelte';
  import Tabs from './Tabs.svelte';
  import { selected } from '../store';
  import { fade } from 'svelte/transition';
  import { env } from '../env/dev.env';

  const fromAnsi = ansi.default;

  const tabs: ITab[] = [
    { name: 'Dependencies graph', component: DependenciesGraph },
    { name: 'Service logs', component: ServiceLogs },
    { name: 'Compilation Logs', component: BuildLogs },
  ];

  let node: INodeSummary;

  let height = 0;
  let width = 0;
</script>

<style lang="scss">
  .node-details {
    overflow: hidden;
  }
</style>

{#if $selected}
<section class="node-details" transition:fade={{duration: env.transitionDuration}}>
  <NodeHeader/>
  <NodeActions/>
  <NodeInfos/>
  <Tabs tabs="{tabs}"/>
</section>
{/if}
