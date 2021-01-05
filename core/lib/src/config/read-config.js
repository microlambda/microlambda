"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigReader = void 0;
const tslib_1 = require("tslib");
const joi_1 = tslib_1.__importDefault(require("@hapi/joi"));
const rc_1 = tslib_1.__importDefault(require("rc"));
const default_json_1 = tslib_1.__importDefault(require("./default.json"));
const glob_1 = require("glob");
const path_1 = require("path");
class ConfigReader {
    constructor(logger) {
        this._logger = logger.log('config');
    }
    get config() {
        return this._config;
    }
    readConfig() {
        this._config = rc_1.default('microlambda', default_json_1.default);
        return this._config;
    }
    validate(graph) {
        this._services = graph.getServices();
        this._buildConfigSchema();
        if (!this._config) {
            this._config = this.readConfig();
        }
        this._logger.debug('raw config', this._config);
        const { error, value } = this._schema.validate(this._config);
        if (error) {
            this._logger.error('validation errors', error);
            throw error;
        }
        this._logger.info('config valid');
        this._config = value;
        return this._config;
    }
    getRegions(service, stage) {
        this._logger.debug('Resolving regions', { service, stage });
        const config = this.readConfig();
        const formatRegion = (config) => {
            if (Array.isArray(config)) {
                return config;
            }
            return [config];
        };
        const getRegion = (config) => {
            if (typeof config === 'string' || Array.isArray(config)) {
                return formatRegion(config);
            }
            if (config[stage]) {
                return formatRegion(config[stage]);
            }
            return null;
        };
        if (config.regions && config.regions[service]) {
            this._logger.debug('Regions specified at service-level', config.regions[service]);
            const regions = getRegion(config.regions[service]);
            this._logger.debug('Should be deployed @', regions);
            if (regions) {
                return regions;
            }
        }
        if (config.defaultRegions) {
            this._logger.debug('Fallback on default regions', config.defaultRegions);
            const regions = getRegion(config.defaultRegions);
            this._logger.debug('Should be deployed @', regions);
            if (regions) {
                return regions;
            }
        }
        this._logger.debug('Fallback on user preferred region', process.env.AWS_REGION);
        if (process.env.AWS_REGION) {
            return [process.env.AWS_REGION];
        }
        throw Error('Default region is not set. No fallback available');
    }
    getAllRegions(stage) {
        this._logger.debug('Finding all region in config for stage', stage);
        const allRegions = new Set();
        const schedule = this.scheduleDeployments(stage);
        for (const step of schedule) {
            for (const region of step.keys()) {
                allRegions.add(region);
            }
        }
        this._logger.debug('All regions', [...allRegions]);
        return [...allRegions];
    }
    scheduleDeployments(stage) {
        this._logger.info('Scheduling deployment steps', { stage });
        const steps = this.readConfig().steps;
        this._logger.info('From config', steps);
        const schedule = (services) => {
            const step = new Map();
            services.forEach((s) => {
                const regions = this.getRegions(s, stage);
                regions.forEach((r) => {
                    if (step.has(r)) {
                        step.get(r).add(s);
                    }
                    else {
                        step.set(r, new Set([s]));
                    }
                });
            });
            return step;
        };
        if (!steps) {
            this._logger.debug('No specific config for steps. Using default', schedule(this._services.map((s) => s.getName())));
            const step = schedule(this._services.map((s) => s.getName()));
            return [step];
        }
        const builtSteps = [];
        for (const step of steps) {
            this._logger.debug('Scheduling', step);
            let toSchedule;
            if (step === '*') {
                toSchedule = this._services
                    .map((s) => s.getName())
                    .filter((s) => !steps.filter((step) => Array.isArray(step)).some((step) => step.includes(s)));
                this._logger.debug('Is wildcard. Resolving all other services', toSchedule);
            }
            else {
                toSchedule = step;
            }
            const scheduled = schedule(toSchedule);
            builtSteps.push(scheduled);
        }
        this._logger.debug('Steps scheduled', builtSteps);
        return builtSteps;
    }
    _buildConfigSchema() {
        const services = joi_1.default.string().valid(...this._services.map((s) => s.getName()));
        const regionSchema = joi_1.default.alternatives([
            joi_1.default.string().valid(...ConfigReader.regions),
            joi_1.default.array().items(joi_1.default.string().valid(...ConfigReader.regions)),
            joi_1.default.object().pattern(joi_1.default.string().alphanum(), joi_1.default.alternatives([
                joi_1.default.string().valid(...ConfigReader.regions),
                joi_1.default.array().items(joi_1.default.string().valid(...ConfigReader.regions)),
            ])),
        ]);
        this._schema = joi_1.default.object()
            .keys({
            stages: joi_1.default.array()
                .items(joi_1.default.string())
                .optional()
                .allow(null),
            compilationMode: joi_1.default.string().valid('safe', 'fast'),
            ports: joi_1.default.object().pattern(services, joi_1.default.number()
                .integer()
                .greater(0)
                .less(64738)),
            noStart: joi_1.default.array()
                .items(services)
                .optional(),
            defaultRegions: regionSchema.optional().allow(null),
            regions: joi_1.default.object()
                .pattern(services, regionSchema)
                .optional(),
            steps: joi_1.default.array()
                .items(joi_1.default.alternatives([joi_1.default.string().valid('*'), joi_1.default.array().items(services)]))
                .optional(),
            domains: joi_1.default.object()
                .pattern(services, joi_1.default.object()
                .pattern(joi_1.default.string(), joi_1.default.string())
                .optional())
                .optional(),
            yamlTransforms: joi_1.default.array()
                .items(joi_1.default.string())
                .optional(),
        })
            .unknown(true);
    }
    getCustomDomain(name, stage) {
        return this._config.domains[name] ? this._config.domains[name][stage] : null;
    }
    getYamlTransformations(projectRoot) {
        const matches = new Set();
        this._config.yamlTransforms
            .map((glob) => path_1.join(projectRoot, glob))
            .forEach((glob) => {
            glob_1.sync(glob).forEach((path) => matches.add(path));
        });
        return Array.from(matches);
    }
}
exports.ConfigReader = ConfigReader;
ConfigReader.regions = [
    'us-east-1',
    'us-east-2',
    'us-west-1',
    'us-west-2',
    'ca-central-1',
    'eu-west-1',
    'eu-west-2',
    'eu-west-3',
    'eu-central-1',
    'ap-southeast-1',
    'ap-southeast-2',
    'ap-northeast-1',
    'ap-northeast-2',
    'ap-northeast-3',
    'eu-north-1',
    'sa-east-1',
    'cn-north-1',
    'cn-northwest-1',
    'ap-east-1',
    'me-south-1',
    'ap-south-1',
];
//# sourceMappingURL=read-config.js.map