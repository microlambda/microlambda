import { Node } from './graph';
import { Logger } from './logger';
export interface IChecksums {
    [file: string]: string;
}
export declare const checksums: (node: Node, logger: Logger) => {
    calculate: () => Promise<IChecksums>;
    read: () => Promise<IChecksums>;
    write: (data: IChecksums) => Promise<void>;
    compare: (old: IChecksums, current: IChecksums) => boolean;
};
