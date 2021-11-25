import { promises as fs } from 'fs';

export const injector = async (path: string, token: string, content: string): Promise<void> => {
  const file = await fs.readFile(path);
  const lines = file.toString().split('\n');
  const injectAt = lines.indexOf(lines.find((l) => l.includes(`\${blueprint:${token}`)));
  const updatedLines = [...lines.slice(0, injectAt), ...content.split('/n'), ...lines.slice(injectAt)];
  await fs.writeFile(path, updatedLines.join('\n'));
};
