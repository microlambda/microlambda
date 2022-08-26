import { extract as deflate, Pack, pack } from 'tar-stream';
import { relative, resolve as pathResolve, dirname } from 'path';
import { createReadStream, createWriteStream, promises as fs, existsSync, mkdirSync } from 'fs';
import { Readable, Writable} from "stream";

type FileInfo = {name: string, size: number, stream: Readable};

export class TarArchive {

  private pack = pack();
  private streamQueue: FileInfo[] = [];
  private size = 0;

  addStream(name: string, size: number, stream: Readable): TarArchive {
    this.streamQueue.push({
      name, size, stream
    });
    return this;
  }

  async write(streamCallback: (pack: Pack) => Writable): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.nextEntry((err) => {
        if (err) {
          reject(err)
        } else {
          resolve();
        }
      }, this.streamQueue.length);
      streamCallback(this.pack)
        .on('error', (err) => {
          this.pack.destroy(err);
          reject(err);
        })
    });
  }

  private nextEntry(callback: (err?: unknown) => void, total: number): void {
    const file = this.streamQueue.shift();
    if (file) {
      const writeEntryStream = this.pack.entry({
        name: file.name,
        size: file.size
      }, (err: unknown) => {
        if (err) {
          callback(err);
        } else {
          this.size += file.size;
          console.log(`Added ${file.name}`, file.size, this.size, `${total - this.streamQueue.length}/${total}`);
          this.nextEntry(callback, total);
        }
      });
      file.stream.pipe(writeEntryStream);
    } else {
      this.pack.finalize();
      callback();
    }
  }
}


export const compress = async (paths: string[], relativeTo?: string): Promise<TarArchive> => {
  const tar = new TarArchive();
  for (const file of paths) {
    const meta = await fs.lstat(file);
    tar.addStream(relative(relativeTo || process.cwd(), file), meta.size, createReadStream(file));
  }
  return tar;
}

export const extract = async (archiveStream: Readable, relativeTo?: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const tar = deflate();
    tar.on('entry', (header, stream, next) => {
      const dest = pathResolve(relativeTo || process.cwd(),  header.name);
      if (!existsSync(dirname(dest))) {
        mkdirSync(dirname(dest), { recursive: true });
      }
      const writeStream = createWriteStream(dest);
      stream.on('data', (chunk) => {
        writeStream.write(chunk);
      });
      stream.on('error', (err) => {
        return reject(err);
      });
      stream.on('end', () => {
        writeStream.end();
        next();
      })
      stream.resume() // just auto drain the stream
    });
    archiveStream.pipe(tar);
    tar.on('finish', () => {
      return resolve();
    });
  });
}
