"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePorts = void 0;
const project_1 = require("./yarn/project");
exports.resolvePorts = (services, config, logger, defaultPort = 3001) => {
    logger.log('port').debug('Resolving port from config', config);
    const result = {};
    services.forEach((service) => {
        const name = project_1.getName(service);
        const inConfig = config.ports[name] != null;
        const port = inConfig ? config.ports[name] : defaultPort;
        if (!inConfig) {
            defaultPort++;
        }
        result[name] = port;
    });
    logger.log('port').debug('Ports resolved', result);
    return result;
};
//# sourceMappingURL=resolve-ports.js.map