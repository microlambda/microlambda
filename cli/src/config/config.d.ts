export type CompilationMode = 'safe' | 'fast';

export interface IConfig {
  compilationMode: CompilationMode;
  ports: { [key: string]: number };
  noStart: string[];
}
