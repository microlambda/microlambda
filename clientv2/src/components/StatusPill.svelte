<script lang="ts">
  import { ServiceStatus, TranspilingStatus, TypeCheckStatus } from '@microlambda/types';
  import {
    getServiceStatus, getServiceStatusClass,
    getTranspiled,
    getTranspiledClass,
    getTypeCheckClass,
    getTypeChecked,
  } from '../utils/status.utils';

  export let size: 'small' | 'big' = 'small';
  export let enabled = false;
  export let transpiled: TranspilingStatus = null;
  export let typeChecked: TypeCheckStatus = null;
  export let serviceStatus: ServiceStatus = null;

  let status, statusClass: string;

  $: {
    if (transpiled != null) {
      status = getTranspiled(transpiled);
      statusClass = getTranspiledClass(transpiled);
    }
    if (typeChecked != null) {
      status = getTypeChecked(typeChecked);
      statusClass = getTypeCheckClass(typeChecked);
    }
    if (serviceStatus != null) {
      status = getServiceStatus(serviceStatus, enabled);
      statusClass = getServiceStatusClass(serviceStatus, enabled);
    }
  }
</script>

<style lang="scss">
  @import '../variables.scss';
  span.status {
    &.small {
      border-radius: 50%;
      height: 15px;
      width: 15px;
    }
    &.big {
      height: 20px;
      padding: 2px 10px;
      border-radius: 10px;
      font-size: 13px;
      justify-content: center;
      align-items: center;
    }
    background-color: $grey;
    display: inline-flex;
    margin: 1px;
    &.red {
      background-color: $red;
    }
    &.bright-red {
      background-color: $bright-red;
    }
    &.green {
      background-color: $green;
    }
    &.blue {
      background-color: $blue;
    }
  }
</style>

<span class="status { statusClass } {size}" title="{status}">
  {#if size === 'big'} {status} {/if}
</span>
