import { pack, extract as deflate } from 'tar-stream';
import { relative, resolve as pathResolve } from 'path';
import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { Readable } from 'stream';

export const compress = async (paths: string[], relativeTo?: string): Promise<Readable> => {
  console.debug('Compressing', paths);
  const archive = pack();
  let processed = 0;
  const compressEntry = (path: string) => new Promise<void>((resolve, reject) => {
    console.debug('Resolving size');
    fs.stat(path).then((stats) => {
      console.debug('Size', stats.size);
      const readFile = createReadStream(path);
      console.debug('i');
      const entry = archive.entry({ name: relative(relativeTo || process.cwd(), path), size: stats.size }, (err) => {
        if (err) {
          console.error('Error', err);
          return reject(err);
        }
      });
      console.debug('ii');
      readFile.on('error', (err) => {
        console.error('iv')
        console.error(err);
        reject(err);
      });
      entry.on('error', (err) => {
        console.error('v')
        console.error(err);
        reject(err);
      });
      entry.on('finish', () => {
        console.debug('iii');
        resolve();
      });
      readFile.pipe(entry);
    }).catch((err) => {
      console.error('vi')
      console.error(err);
      return reject(err);
    })
  });
  for (const path of paths) {
    console.debug('Compressing', path);
    try {
      await compressEntry(path);
    } catch (e) {
      console.debug('err', e);
      throw e;
    }
    console.debug('Compressed', path);
    processed++;
    console.debug('Processed', processed, '/', paths.length);
    if (processed === paths.length) {
      console.debug('Archive finalized')
      archive.finalize();
    } else {
      console.debug('Processing next entry');
    }
  }
  return archive;
}

export const extract = async (archiveStream: Readable, relativeTo?: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const tar = deflate();
    tar.on('entry', (header, stream, next) => {
      console.debug('Processing entry', header.name);
      const writeStream = createWriteStream(pathResolve(relativeTo || process.cwd(), header.name));
      stream.on('data', (chunk) => {
        writeStream.write(chunk);
      });
      stream.on('error', (err) => {
        return reject(err);
      });
      stream.on('end', () => {
        console.debug('Processing next entry');
        writeStream.end();
        next();
      })
      stream.resume() // just auto drain the stream
    });
    archiveStream.pipe(tar);
    tar.on('finish', () => {
      console.debug('Extracted');
      return resolve();
    });
  });
}
