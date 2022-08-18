export type LambdaRuntimes = 'nodejs' | 'nodejs4.3' | 'nodejs6.10' | 'nodejs8.10' | 'nodejs10.x' | 'nodejs12.x' | 'nodejs14.x' | 'java8' | 'java8.al2' | 'java11' | 'python2.7' | 'python3.6' | 'python3.7' | 'python3.8' | 'python3.9' | 'dotnetcore1.0' | 'dotnetcore2.0' | 'dotnetcore2.1' | 'dotnetcore3.1' | 'nodejs4.3-edge' | 'go1.x' | 'ruby2.5' | 'ruby2.7' | 'provided' | 'provided.al2';

export interface IPackagrConfig {
    useLayer?: boolean;
    level?: number;
    checksums?: {
        bucket: string;
        key: string;
    };
    runtimes?: LambdaRuntimes[];
    architecture?: 'x86_64' | 'arm64';
    prune?: number;
}
