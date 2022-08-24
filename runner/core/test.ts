import { extract } from './src/archive';
import { aws } from '@microlambda/aws';

(async () => {
  try {
    const downloadStream = await aws.s3.downloadStream('my-app-mila-checksums', 'test.tar', 'eu-west-1');
    await extract(downloadStream, __dirname);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
