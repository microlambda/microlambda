import {arnToCurrentUserIAM} from "../../src/iam/get-current-user";

describe('arnToCurrentUserIAM', () => {
    it('should parse correctly project id and username', () => {
        const arn = 'arn:aws:iam::<project-id>:user/<username>';
        const res = arnToCurrentUserIAM(arn);
        expect(res.arn).toEqual(arn);
        expect(res.projectId).toEqual('<project-id>');
        expect(res.username).toEqual('<username>');
    });

    it('should return empty projectId and userName if arn does not match correct ARN', () => {
        const arn = 'invalid-arn';
        const res = arnToCurrentUserIAM(arn);
        expect(res.arn).toEqual(arn);
        expect(res.projectId).toEqual(undefined);
        expect(res.username).toEqual(undefined);
    });
});
