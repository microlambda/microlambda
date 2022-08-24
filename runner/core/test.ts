import { extract } from './src/archive';

(async () => {
  try {
    await extract('test.tar');
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();

