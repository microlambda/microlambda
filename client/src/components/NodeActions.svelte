<script lang="ts">
  import type { ServiceStatus } from '@microlambda/types';
  import { selected, schedulerStatus } from '../store';
  import { startService, stopService, restartService } from '../api';
  import Button from './Button.svelte';
  import { fade } from 'svelte/transition';
  import { env } from '../env/dev.env';
  import { logger } from '../logger';
  import { onMount } from 'svelte';

  let schedulerBusy = false;

  const log = logger.scope('<NodeActions/>');

  schedulerStatus.subscribe((status) => {
    // FIXME: weird error
    log.info('Scheduler status updated', status);
    schedulerBusy = status === 1;
  });

  onMount(() => {
    log.debug('Mounted');
    schedulerStatus.fetch();
  });

</script>

{#if $selected}
<div class="actions" transition:fade={{duration: env.transitionDuration}}>
  {#if $selected?.type === 'service'}
    {#if [ServiceStatus.RUNNING, ServiceStatus.STARTING].includes($selected?.status)}
      <Button disabled="{schedulerBusy}" on:click={stopService($selected?.name)}>Stop</Button>
      <Button disabled="{schedulerBusy}" on:click={restartService($selected?.name)}>Restart</Button>
      {:else}
      <Button disabled="{schedulerBusy}" on:click={startService($selected?.name)}>Start</Button>
    {/if}
    <!--<Button>Package</Button>
    <Button>Deploy</Button>
    <Button>Remove</Button>-->
  {/if}
  <Button disabled="{schedulerBusy}">Build</Button>
</div>
{/if}
