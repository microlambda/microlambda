import { pack, extract as deflate } from 'tar-stream';
import { relative, resolve as pathResolve } from 'path';
import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { Readable } from 'stream';

export const compress = async (paths: string[], relativeTo?: string): Promise<Readable> => {
  const archive = pack();
  let processed = 0;
  const compressEntry = (path: string) => new Promise<void>((resolve, reject) => {
    fs.stat(path).then((stats) => {
      const entry = archive.entry({ name: relative(relativeTo || process.cwd(), path), size: stats.size }, (err) => {
        if (err) {
          return reject(err);
        }
      });
      const readFile = createReadStream(path);
      readFile.on('data', (chunk) => {
        entry.write(chunk);
      });
      readFile.on('error', (e) => {
        return reject(e);
      });
      readFile.on('end', () => {
        entry.end();
        return resolve();
      });
    }).catch((err) => {
      return reject(err);
    })
  });
  for (const path of paths) {
    await compressEntry(path);
    processed++;
    if (processed === paths.length) {
      archive.finalize();
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
