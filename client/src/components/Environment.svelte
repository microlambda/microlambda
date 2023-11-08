<script lang="ts">
    import {servicesInstances} from "../store/remote-state";
    import type {IServiceInstance} from "../types/env-var";
    import {loadingInstances} from "../store/remote-state.js";

    let regions: Array<string>;
    let services: Map<string, Map<string, IServiceInstance>>;
    servicesInstances.subscribe((instances) => {
      services = new Map();
      const allRegions = new Set<string>();
      for (const instance of instances) {
        allRegions.add(instance.region);
        const instanceByService = services.get(instance.name);
        if (instanceByService) {
          instanceByService.set(instance.region, instance);
        } else {
          services.set(instance.name, new Map([[instance.region, instance]]));
        }
      }
      regions = [...allRegions];
    });
</script>

<style lang="scss">
    table {
      width: 100%;
      th, td {
        text-align: left;
        font-size: 11pt;
      }
      th {
        font-weight: bolder;
        padding: 1rem 0;
      }
      td {
        padding: 0.4rem;
      }
      td.sha1 {
        font-family: "Roboto Mono", monospace;
      }
      tbody tr:nth-child(odd) {
        background-color: #303030;
      }
    }
</style>
{#if $loadingInstances}
{:else}
{#if services.size}
<table>
    <thead>
        <tr>
            <th>Service</th>
            {#each regions as region}
            <th>{region}</th>
            {/each}
        </tr>
    </thead>
    <tbody>
        {#each [...services.keys()].sort((a, b) => a.localeCompare(b)) as service}
        <tr>
            <td>{service}</td>
            {#each regions as region}
                <td class="sha1">{services.get(service).get(region)?.sha1?.slice(0, 7) ?? 'not deployed'}</td>
            {/each}
        </tr>
        {/each}
    </tbody>
</table>
{:else}
<h3>Nothing to show ¯\_(ツ)_/¯</h3>
{/if}
{/if}
