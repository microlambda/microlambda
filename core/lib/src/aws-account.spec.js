"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const sinon_1 = require("sinon");
const aws_sdk_1 = tslib_1.__importDefault(require("aws-sdk"));
const aws_account_1 = require("./aws-account");
describe('[method] getAccountIAM', () => {
    let awsStub;
    beforeEach(() => {
        awsStub = sinon_1.stub(aws_sdk_1.default, 'IAM');
    });
    afterEach(() => {
        awsStub.restore();
    });
    it('should return currently authenticated user name', async () => {
        awsStub.returns({
            getUser: () => ({
                promise: async () => ({
                    User: { Arn: '$arn' },
                }),
            }),
        });
        expect(await aws_account_1.getAccountIAM()).toBe('$arn');
    });
    it('should not throw and return username if he has no permission to get himself on AWS IAM', async () => {
        awsStub.returns({
            getUser: () => ({
                promise: async () => {
                    const error = {
                        code: 'AccessDenied',
                        message: 'User: $arn is not authorized to perform action $foo on resource $bar',
                    };
                    throw error;
                },
            }),
        });
        expect(await aws_account_1.getAccountIAM()).toBe('$arn');
    });
    it('should throw original error otherwise', async () => {
        awsStub.returns({
            getUser: () => ({
                promise: async () => {
                    const error = {
                        code: 'TokenExpired',
                        message: 'Your token is expired',
                    };
                    throw error;
                },
            }),
        });
        try {
            await aws_account_1.getAccountIAM();
            fail();
        }
        catch (e) {
            expect(e.code).toBe('TokenExpired');
        }
    });
});
//# sourceMappingURL=aws-account.spec.js.map