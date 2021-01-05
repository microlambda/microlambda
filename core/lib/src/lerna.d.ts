import { ExecaChildProcess } from 'execa';
export interface ILernaPackage {
    name: string;
    version: string;
    private: boolean;
    location: string;
}
export declare class LernaHelper {
    private _packages;
    static runCommand(cmd: string, scopes: string[], region?: string, concurrency?: number, env?: {
        [ket: string]: string;
    }): ExecaChildProcess<string>;
    getAllPackages(cwd?: string): Promise<ILernaPackage[]>;
    getServices(cwd?: string): Promise<ILernaPackage[]>;
    private static _readServiceYaml;
    static hasCustomDomain(service: ILernaPackage): boolean;
    static getCustomDomain(service: string, stage: string): string;
    static getServiceName(service: ILernaPackage): string;
}
