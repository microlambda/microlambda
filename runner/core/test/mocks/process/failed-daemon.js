(async () => {
  console.info('Launching...');
  setTimeout(() => {
    console.error('Something wrong happened, watching for changes');
    while(1) {}
  }, 200);
})();
