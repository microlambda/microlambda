import {ILayerChecksums} from "./layer-checksums";

export const compareLayerChecksums = async (checksums1: ILayerChecksums | null, checksums2: ILayerChecksums | null): Promise<boolean> => {
    if (checksums1 && checksums2 && Object.keys(checksums1).length === Object.keys(checksums2).length ) {
        const hasSameKeys = Object.keys(checksums1).every((k) => Object.keys(checksums2).includes(k)) && Object.keys(checksums2).every((k) => Object.keys(checksums1).includes(k));
        if (!hasSameKeys) {
            return false;
        }
        for (const key of Object.keys(checksums1)) {
            if (checksums1[key] !== checksums2[key]) {
                return false;
            }
        }
        return true;
    }
    return false;
};
