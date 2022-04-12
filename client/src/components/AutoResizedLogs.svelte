<script lang='ts'>
  import Logs from './Logs.svelte';
  import { offlineLogs, tabMounted } from '../store';
  import { tscLogs } from '../store';
  import { logger } from '../logger';
  export let type: 'offline' | 'tsc';

  const log = logger.scope('<BuildLogs/>');
  let height, width = 0;

  const fitToTabContent = () => {
    const tabContent = document.getElementById('tab-content');
    log.debug('Fitting graph to tab content', tabContent);
    const controlsHeight = document.getElementById('logs--controls')?.getBoundingClientRect()?.height || 0;
    height = tabContent.clientHeight - 30 - controlsHeight;
    width = tabContent.clientWidth - 30 - controlsHeight;
    log.debug('To content dimensions', {height});
  }

  tabMounted.subscribe((ready) => {
    log.debug('Tab mounted', ready);
    if (ready) {
      fitToTabContent();
    }
  });

  window.onresize = fitToTabContent;
</script>

{#if type}
<Logs logs="{type === 'tsc' ? $tscLogs : $offlineLogs}" height="{height}" width="{width}"/>
{/if}
