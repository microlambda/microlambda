<script lang='ts'>
  import Disconnected from './components/Disconnected.svelte';
  import { connected, selected, selectedEnv } from './store';
  import Sidebar from './components/Sidebar.svelte';
  import EventLog from './components/EventLog.svelte';
  import Node from './components/Node.svelte';
  import Header from './components/Header.svelte';
  import Environment from "./components/Environment.svelte";
</script>

<style lang="scss">
	@import './variables.scss';
		/* Works on Firefox */
  :global(*) {
			scrollbar-width: thin;
			scrollbar-color: $light_grey $anthracite_lighter;
		}

		/* Works on Chrome, Edge, and Safari */
  :global(*::-webkit-scrollbar) {
			width: 10px;
      height: 10px;
  }

  :global(*::-webkit-scrollbar-track) {
			background: $anthracite_lighter;
      border-radius: 5px;
		}

  :global(*::-webkit-scrollbar-thumb) {
			background-color: $light_grey;
			border-radius: 20px;
			border: 2px solid $anthracite_lighter;
  }

  :global(*::-webkit-scrollbar-corner) {
    background-color: transparent;
  }

  :global(button:focus) { outline: none; }

  :global(body) {
	  margin: 0;
		font-family: 'Roboto' ,Arial, Helvetica, sans-serif;
		background-color: $anthracite;
		color: #f6f6f6;
	}
	:global(ul) {
		list-style-type: none;
		padding-left: 0;
	}
	.main {
		height: calc(100vh - #{$header_border + $header_height});
    width: 100vw;
		overflow: hidden;
    display: flex;
	}
  .panel {
    background-color: $anthracite_lighter;
    flex: 1 1;
    padding: 30px;
    overflow: auto;
  }
</style>

<svelte:head>
	<title>Microlambda | Client</title>
	<link rel="preconnect" href="https://fonts.gstatic.com">
	<link href="https://fonts.googleapis.com/css2?family=Roboto&family=Roboto+Mono&display=swap" rel="stylesheet">
  <meta name="robots" content="noindex nofollow" />
</svelte:head>

<Header/>
<section class="main">
  {#if $connected}
    <Sidebar/>
    <div class="panel">
        {#if $selected}
         <Node/>
        {:else if $selectedEnv}
        <Environment/>
        {:else}
        <EventLog/>
      {/if}
    </div>
  {:else}
    <Disconnected/>
  {/if}
</section>
