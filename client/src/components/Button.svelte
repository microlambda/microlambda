<script lang="ts">
  export let disabled = false;
</script>

<style lang="scss">
  @import '../variables.scss';
  button {
    height: 30px;
    color: white;
    background-color: $anthracite;
    border: 1px solid white;
    border-radius: 15px;
    padding: 2px 15px;
    cursor: pointer;
    &:hover {
       background-color: $anthracite_lighter;
     }
    &.disabled {
      cursor: not-allowed;
    }
  }
</style>

<button class:disabled="{disabled}" disabled="{disabled}" on:click>
  <slot/>
</button>
