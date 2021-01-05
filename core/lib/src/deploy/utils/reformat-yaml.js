"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reformatYaml = exports.restoreYaml = exports.backupYaml = exports.getPath = void 0;
const path_1 = require("path");
const fs_extra_1 = require("fs-extra");
const js_yaml_1 = require("js-yaml");
const yaml_1 = require("../../yaml");
exports.getPath = (service) => {
    const serviceName = service.match(/^@dataportal\/(.+)$/)[1];
    return path_1.join('services', serviceName);
};
const getServerlessPath = (service) => {
    const basePath = exports.getPath(service);
    const src = path_1.join(basePath, 'serverless.yml');
    const dest = path_1.join(basePath, 'serverless.yml.backup');
    return { src, dest };
};
exports.backupYaml = (services) => {
    services.forEach((service) => {
        const { src, dest } = getServerlessPath(service);
        try {
            fs_extra_1.renameSync(src, dest);
        }
        catch (e) {
            if (!fs_extra_1.existsSync(dest)) {
                throw e;
            }
        }
    });
};
exports.restoreYaml = (services) => {
    services.forEach((service) => {
        const { src, dest } = getServerlessPath(service);
        fs_extra_1.removeSync(src);
        fs_extra_1.renameSync(dest, src);
    });
};
exports.reformatYaml = (services, region, env) => {
    services.forEach((service) => {
        const { src, dest } = getServerlessPath(service);
        console.log('Reformatting', src);
        const doc = js_yaml_1.load(fs_extra_1.readFileSync(dest, 'utf8'), {
            schema: yaml_1.CUSTOM_SCHEMA,
        });
        const toDelete = [];
        for (const functionName of Object.keys(doc.functions)) {
            const functionDef = doc.functions[functionName];
            if (functionDef.region && functionDef.region !== region) {
                toDelete.push(functionName);
            }
            else if (doc.functions[functionName].events) {
                for (const trigger of doc.functions[functionName].events) {
                    if (trigger.http && trigger.http.authorizer && trigger.http.authorizer.name === 'auth') {
                        delete trigger.http.authorizer.name;
                        trigger.http.authorizer.arn = `arn:aws:lambda:${region}:624074376577:function:dataportal-auth-${env}-auth`;
                    }
                }
            }
        }
        toDelete.forEach((name) => delete doc.functions[name]);
        const removePlugins = ['serverless-offline', 'serverless-webpack'];
        if (doc.plugins) {
            doc.plugins = doc.plugins.filter((p) => !removePlugins.includes(p));
        }
        fs_extra_1.writeFileSync(src, js_yaml_1.dump(doc, {
            schema: yaml_1.CUSTOM_SCHEMA,
        }));
    });
};
//# sourceMappingURL=reformat-yaml.js.map