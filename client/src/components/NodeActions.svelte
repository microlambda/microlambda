<script lang="ts">
  import { selected } from '../store';
  import { startService, stopService, restartService } from '../api';
  import Button from './Button.svelte';
  import { fade } from 'svelte/transition';
  import { env } from '../env/dev.env';
  import { logger } from '../logger';
  const log = logger.scope('<NodeActions/>');
</script>

{#if $selected}
<div class="actions" transition:fade={{duration: env.transitionDuration}}>
  {#if $selected?.type === 'service'}
    {#if [0, 1].includes($selected?.status)}
      <Button on:click={stopService($selected?.name)}>Stop</Button>
      <Button on:click={restartService($selected?.name)}>Restart</Button>
      {:else}
      <Button on:click={startService($selected?.name)}>Start</Button>
    {/if}
    <!--<Button>Package</Button>
    <Button>Deploy</Button>
    <Button>Remove</Button>-->
  {/if}
  <Button>Build</Button>
</div>
{/if}
