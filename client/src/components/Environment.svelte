<script lang="ts">
</script>

<style lang="scss">
</style>

{#if loading}
    <span>Loading</span>
{:else}
    <select bind:value={selectedEnv} on:change={(e) => selectEnv(e.target.value)}>
        {#each allEnvs as env}<option value="{env}">{env}</option>{/each}
    </select>
    <table>
        <thead>
        <tr>
            <th>Key</th>
            <th>Value</th>
        </tr>
        </thead>
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
