(async () => {
  console.info('Launching...');
  setTimeout(() => {
    console.error('Something really bad happened');
    process.exit(1);
  }, 200);
})();
