export type CompilationMode = 'safe' | 'fast';

export interface IConfig {
  stages: string[];
  compilationMode: CompilationMode;
  ports: { [key: string]: number };
  noStart: string[];
}
