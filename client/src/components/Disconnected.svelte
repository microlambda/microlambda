<style lang="scss">
    @import '../variables.scss';
  	.disconnected {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-direction: column;
		height: 100%;
    width: 100%;
    .wrapper {
			height: 450px;
			width: 450px;
			background-color: white;
			border-radius: 50%;
			display: flex;
			align-items: center;
			justify-content: center;
			flex-direction: column;
			p {
				color: $anthracite;
			}
		}
	}
</style>

<div class="disconnected">
  <div class="wrapper">
    <img height="200px" src="down.svg" alt="disconnected"/>
    <p class="waiting">Waiting for mila server</p>
  </div>
</div>
