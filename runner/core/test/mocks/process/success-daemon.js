(async () => {
  console.info('Launching...');
  setTimeout(() => {
    console.info('Fake daemon up and running');
    while(1) {}
  }, 200);
})();
