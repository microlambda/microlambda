import { dirname } from 'path';
import { promises as fs } from 'fs';
import { render } from 'ejs';
import { exists } from './fs-exists';

export const renderTemplates = async (
  templates: Map<string, unknown>,
  destinations: Map<string, string>,
  inputs: Record<string, unknown>,
): Promise<void> => {
  await Promise.all(
    Array.from(destinations.keys()).map(async (templatePath) => {
      const template = templates.get(templatePath);
      const content = render(template.toString(), inputs);
      const destination = destinations.get(templatePath);
      const folderPath = dirname(destination);
      const folderExists = await exists(folderPath);
      if (!folderExists) {
        await fs.mkdir(folderPath, { recursive: true });
      }
      await fs.writeFile(destination, content);
    }),
  );
};
