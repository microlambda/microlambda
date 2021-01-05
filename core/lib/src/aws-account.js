"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAccountIAM = void 0;
const aws_sdk_1 = require("aws-sdk");
exports.getAccountIAM = async () => {
    try {
        const iam = new aws_sdk_1.IAM();
        const currentUser = await iam.getUser().promise();
        return currentUser.User.Arn;
    }
    catch (e) {
        if (e.code === 'AccessDenied' && e.message.match(/User: (.+) is not authorized to perform/)) {
            return e.message.match(/User: (.+) is not authorized to perform/)[1];
        }
        throw e;
    }
};
//# sourceMappingURL=aws-account.js.map