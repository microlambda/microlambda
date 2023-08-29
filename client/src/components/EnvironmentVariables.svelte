<script lang="ts">
    import type {ILoadedEnvironmentVariable} from "../types/env-var";
    import {loadingServiceEnvironment, loadServiceEnvironment, serviceEnvironment} from "../store/env-vars";
    import {environments} from "../store/environments";
    import {selected} from "../store/workspace-selected";

    let allEnvs: string[] = [];
    let selectedEnvVariables: Array<ILoadedEnvironmentVariable> = [];
    let selectedEnv = 'local';
    let selectedService: string | undefined;
    let loading = true;

    environments.subscribe((envs) => allEnvs = ['local', ...envs.map((e) => e.name).sort((a, b) => a.localeCompare(b))]);

    loadingServiceEnvironment.subscribe((_loading) => loading = _loading);

    serviceEnvironment.subscribe((res) => {
      console.debug('env vars changed', res);
      selectedEnvVariables = res;
    });

    selected.subscribe((service) => {
      if (service?.isService) {
        selectedService = service.name;
      } else {
        selectedService = undefined;
      }
      load()
    });


    function selectEnv(e: string) {
      selectedEnv = e;
      load();
    }
    function load() {
      if (selectedService) {
        loadServiceEnvironment(selectedEnv, selectedService);
      }
    }
</script>

<style lang="scss">
    table {
      width: 100%;
      margin: 1rem 0;
      tr:nth-child(even) {
        background-color: #3C3C3C;
      }
      tr {
        vertical-align: center;
        td, th {
          text-align: left;
          padding: 0.5rem;
        }
        th {
          padding: 1rem 0;
        }
        td:last-child {
          font-family: "Roboto Mono", monospace;
        }
        td {
          font-size: 10pt;
        }
      }
    }
</style>

{#if loading}
<span>Loading</span>
{:else}
<select bind:value={selectedEnv} on:change={(e) => selectEnv(e.target.value)}>
    {#each allEnvs as env}<option value="{env}">{env}</option>{/each}
</select>
<table>
    <tbody>
     {#each selectedEnvVariables as variable}
         <tr>
             <td>{variable.key}</td>
             <td>{variable.value}</td>
         </tr>
     {/each}
    </tbody>
</table>
{/if}
