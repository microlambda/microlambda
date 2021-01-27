<script>
  import Graph from './Graph.svelte';
  import { selected, tabMounted } from '../store';
  import { logger } from '../logger';

  let height, width = 0;

  const log = logger.scope('<DependenciesGraph/>');

  const fitToTabContent = () => {
    const tabContent = document.getElementById('tab-content');
    log.debug('Fitting graph to tab content', tabContent);
    height = tabContent.clientHeight;
    width = tabContent.clientWidth;
    log.debug('To content dimensions', {height, width});
  }

  tabMounted.subscribe((ready) => {
    log.debug('Tab mounted', ready);
    if (ready) {
      fitToTabContent();
    }
  });

  window.onresize = fitToTabContent;

</script>

<Graph height="{height}" width="{width}" service="{$selected?.name}"/>
