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
      isService = $selected.type === 'service';
      transpiled = $selected.metrics.lastTranspiled ? `${ago($selected.metrics.lastTranspiled)} (took ${numberWithThousandsSeparator($selected.metrics.transpileTook)}ms)` : '-';
      typeChecked = $selected.metrics.lastTypeCheck ? `${ago($selected.metrics.lastTypeCheck)} (took ${numberWithThousandsSeparator($selected.metrics.typeCheckTook)}ms) ${$selected.metrics.typeCheckFromCache ? '[from cache]' : ''}` : '-';
      started = $selected.metrics.lastStarted ? `${ago($selected.metrics.lastStarted)} (took ${numberWithThousandsSeparator($selected.metrics.startedTook)}ms)` : '-';
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
