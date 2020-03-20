export interface IConfig {
  compilationMode: 'lazy' | 'normal' | 'eager';
  ports: { [key: string]: number };
  noStart: string[];
}
