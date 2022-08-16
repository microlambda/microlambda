import simpleGit, { FetchResult, TagResult } from 'simple-git';
import { command } from "execa"

// Types
export interface GitTagsOptions {
  fetch?: boolean;
}

// Namespace
export const git = {
  // Attributes
  git: simpleGit(),
  root: process.cwd(),

  // Methods
  setup(root: string): void {
    this.git = simpleGit({ baseDir: root });
    this.root = root;
  },

  // Commands
  async fetch(...args: string[]): Promise<FetchResult> {
    return this.git.fetch(args);
  },

  async diff(...args: string[]): Promise<string[]> {
    const res = await this.git.diff(args);
    // Parse result
    return res.split('\n').filter(f => f);
  },

  async tags(opts: GitTagsOptions = { fetch: false }): Promise<TagResult> {
    // Fetch tags
    if (opts.fetch) {
      await this.git.fetch(['--tags']);
    }
    // Get tags
    return this.git.tags();
  },

  async tag(version: string): Promise<string> {
    return this.git.tag([version]);
  },

  async commit(files: string[], message: string): Promise<void> {
    await this.git.commit(message, files, { '--allow-empty': null });
  },

  async push(): Promise<void> {
    await this.git.push();
    await this.git.pushTags();
  },

  async revisionExists(rev: string): Promise<boolean> {
    try {
      await command(`git cat-file -t ${rev}`);
      return true;
    } catch (e) {
      return false;
    }
  }
};
