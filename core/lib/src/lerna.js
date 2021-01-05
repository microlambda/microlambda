"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LernaHelper = void 0;
const child_process_1 = require("child_process");
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const execa_1 = require("execa");
const yaml_1 = require("./yaml");
class LernaHelper {
    static runCommand(cmd, scopes, region, concurrency = 4, env) {
        const args = ['npx', 'lerna', 'run'];
        args.push(...cmd.split(' '));
        scopes.forEach((s) => args.push(`--scope=${s}`));
        args.push('--concurrency');
        args.push(concurrency.toString());
        args.push('--stream');
        if (region) {
            args.push('--');
            args.push('--');
            args.push(`--region=${region}`);
        }
        return execa_1.command(args.join(' '), {
            env: { ...env, AWS_REGION: region },
            stdio: 'inherit',
        });
    }
    async getAllPackages(cwd) {
        if (this._packages) {
            return this._packages;
        }
        return new Promise((resolve) => {
            const process = child_process_1.spawn('npx', ['lerna', 'la', '--json'], {
                cwd,
            });
            const chunks = [];
            process.stdout.on('data', (data) => chunks.push(data));
            process.on('close', () => {
                this._packages = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                resolve(this._packages);
            });
        });
    }
    async getServices(cwd) {
        const packages = await this.getAllPackages(cwd);
        return packages.filter((p) => {
            const hasYml = fs_extra_1.existsSync(path_1.join(p.location, 'serverless.yml'));
            const hasYaml = fs_extra_1.existsSync(path_1.join(p.location, 'serverless.yaml'));
            return hasYml || hasYaml;
        });
    }
    static _readServiceYaml(service) {
        const hasYml = fs_extra_1.existsSync(path_1.join(service.location, 'serverless.yml'));
        const hasYaml = fs_extra_1.existsSync(path_1.join(service.location, 'serverless.yaml'));
        if (!hasYaml && !hasYml) {
            throw Error(`${service} is not a valid service`);
        }
        return yaml_1.parseServerlessYaml(path_1.join(service.location, 'serverless.' + (hasYaml ? 'yaml' : 'yml')));
    }
    static hasCustomDomain(service) {
        const yaml = LernaHelper._readServiceYaml(service);
        return yaml.custom && yaml.custom.customDomain && yaml.custom.customDomain.domainName;
    }
    static getCustomDomain(service, stage) {
        return stage === 'prod'
            ? `${service.substr(12)}.api-dataportal.pernod-ricard.io`
            : `${service.substr(12)}.${stage}.api-dataportal.pernod-ricard.io`;
    }
    static getServiceName(service) {
        const yaml = LernaHelper._readServiceYaml(service);
        return yaml.service;
    }
}
exports.LernaHelper = LernaHelper;
//# sourceMappingURL=lerna.js.map