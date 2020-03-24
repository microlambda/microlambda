export type CompilationMode = 'lazy' | 'normal' | 'eager';

export interface IConfig {
  compilationMode: CompilationMode;
  ports: { [key: string]: number };
  noStart: string[];
}
