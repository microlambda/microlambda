<script lang="ts">
  import Logs from './Logs.svelte';
  import { eventsLog } from '../store';
  import { onMount } from 'svelte';
  import { colors } from '../colors';
  import { calculateDimensions } from '../utils/window-dimensions.utils';
  import { env } from '../env/dev.env';

  let logs: string[] = [];
  let height, width = 0;
  let display = false;
  let container: HTMLElement;
  const fitToWindow = () => {
    // Wait for sibling DOM event to be mounted
    setTimeout(() => {
      const dimensions = calculateDimensions(container);
      height = dimensions.height - 70;
      width = dimensions.width - 70;
      display = true;
    }, 1.5 * env.transitionDuration );
  }

  onMount(() => {
    eventsLog.fetch();
    fitToWindow();
  });

  window.onresize = fitToWindow;

  eventsLog.subscribe((rawLogs) => {
    const getLevelColor = (level: string): string => {
      switch (level) {
        case 'debug':
          return colors.blue;
        case 'error':
          return colors.bright_red;
        case 'warn':
          return colors.amber;
        case 'info':
          return colors.green;
        case 'silly':
          return colors.fuschia;
      }
    };
    logs = rawLogs.map((log) => {
      return `<span style="color: ${getLevelColor(log.level)};">[${log.level}]</span> <strong>(${log.scope})</strong> <span style="color: ${colors.light_grey}">${log.date}</span> - ${log.args.join(' ')}\n`;
    });
  });

</script>

<style lang="scss">
  @import "../variables";
  h3 {
    margin-top: 0;
  }
  .events-log {
    background-color: $anthracite;
    padding: 20px;
    border-radius: 5px;
  }
</style>

<section>
  <h3 class="section-header">Events log</h3>
  <div class="events-log" bind:this={container}>
    <Logs logs="{logs}" height="{height}" width="{width}"/>
  </div>
</section>

