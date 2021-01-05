"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.execCmd = void 0;
const child_process_1 = require("child_process");
exports.execCmd = async (cmd, args = null, options = null, stdout = 'debug', stderr = 'error', logger) => {
    return new Promise((resolve, reject) => {
        let _stdout = '';
        const process = child_process_1.spawn(cmd, args, options);
        process.stdout.on('data', (data) => {
            logger.log('child_process')[stdout](data.toString());
            _stdout += data.toString();
        });
        process.stderr.on('data', (data) => logger.log('child_process')[stderr](data.toString()));
        process.on('close', (code) => {
            if (code === 0) {
                return resolve(_stdout);
            }
            return reject('Process exited with code ' + code);
        });
        process.on('error', (e) => {
            logger.log('child_process').error(e);
            return reject(e);
        });
    });
};
//# sourceMappingURL=child-process.js.map