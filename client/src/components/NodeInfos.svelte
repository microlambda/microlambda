<script lang="ts">
  import { selected } from '../store';
  import { onMount } from 'svelte';
  import { logger } from '../logger';
  import { format as ago } from 'timeago.js';
  import { numberWithThousandsSeparator } from '../utils/format.utils';
  import type { INodeSummary } from '@microlambda/types';
  import { fade } from 'svelte/transition';
  import { env } from '../env/dev.env';

  let transpiled, typeChecked, started: string;
  let isService: boolean;
  let node: INodeSummary;

  const updateInfos = (from?: string) => {
    if ($selected) {
      logger.scope('<NodeInfos/>').debug(from, $selected.name, $selected.metrics);
      isService = $selected.type === 'service' && $selected.hasTargets.start;
      transpiled = $selected.metrics.transpile?.finishedAt ? `${ago($selected.metrics.transpile.finishedAt)} (took ${numberWithThousandsSeparator($selected.metrics.transpile.took)}ms)${$selected.metrics.transpile.fromCache ? ' [from cache]' : ''}` : '-';
      typeChecked = $selected.metrics.typecheck?.finishedAt ? `${ago($selected.metrics.typecheck.finishedAt)} (took ${numberWithThousandsSeparator($selected.metrics.typecheck.took)}ms)${$selected.metrics.typecheck.fromCache ? ' [from cache]' : ''}` : '-';
      started = $selected.metrics.start?.finishedAt ? `${ago($selected.metrics.start.finishedAt)} (took ${numberWithThousandsSeparator($selected.metrics.start.took)}ms)` : '-';
    }
  }

  onMount(() => {
    logger.scope('<NodeInfos/>').debug('mounted');
    updateInfos();
    selected.subscribe(() => updateInfos('Node selected'));
  });

</script>

<style lang="scss">
  .infos {
    font-size: 10pt;
    margin: 10px 0;
    td {
      padding: 2px 10px;
    }
    td:first-child {
      padding-left: 0;
    }
  }
</style>

{#if $selected}
<div class="infos" transition:fade={{duration: env.transitionDuration}}>
  <table>
    {#if isService}<tr>
      <td>Allocated port:</td>
      <td>{$selected?.port}</td>
    </tr>{/if}
    {#if !isService}<tr>
      <td>Last transpiled:</td>
      <td>{transpiled || '-'}</td>
    </tr>{/if}
    <tr>
      <td>Last type-checked:</td>
      <td>{typeChecked || '-'}</td>
    </tr>
    {#if isService}
      <tr>
        <td>Last started:</td>
        <td>{started || '-'}</td>
      </tr>{/if}
  </table>
</div>
{/if}
