"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getServiceName = exports.reformatYaml = exports.restoreYaml = exports.backupYaml = exports.parseServerlessYaml = exports.CUSTOM_SCHEMA = void 0;
const js_yaml_1 = require("js-yaml");
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const typescript_1 = require("./typescript");
const logger_1 = require("./logger");
class Mapping {
    constructor(map) {
        this.map = map;
    }
}
class Sequence {
    constructor(...args) {
        this.values = args;
    }
}
class Scalar {
    constructor(value) {
        this.value = value;
    }
}
class Base64 extends Scalar {
}
class GetAtt extends Scalar {
}
class GetAZ extends Scalar {
}
class ImportValue extends Scalar {
}
class Ref extends Scalar {
}
class Sub extends Scalar {
}
class Cidr extends Sequence {
}
class FindInMap extends Sequence {
}
class And extends Sequence {
}
class If extends Sequence {
}
class Not extends Sequence {
}
class Or extends Sequence {
}
class Equals extends Sequence {
}
class Join extends Sequence {
}
class Select extends Sequence {
}
class Split extends Sequence {
}
class Transform extends Mapping {
}
const customTags = [
    { name: '!Base64', instanceOf: Base64, kind: 'scalar' },
    { name: '!GetAtt', instanceOf: GetAtt, kind: 'scalar' },
    { name: '!GetAZs', instanceOf: GetAZ, kind: 'scalar' },
    { name: '!ImportValue', instanceOf: ImportValue, kind: 'scalar' },
    { name: '!Ref', instanceOf: Ref, kind: 'scalar' },
    { name: '!Sub', instanceOf: Sub, kind: 'scalar' },
    { name: '!Cidr', instanceOf: Cidr, kind: 'sequence' },
    { name: '!FindInMap', instanceOf: FindInMap, kind: 'sequence' },
    { name: '!And', instanceOf: And, kind: 'sequence' },
    { name: '!If', instanceOf: If, kind: 'sequence' },
    { name: '!Not', instanceOf: Not, kind: 'sequence' },
    { name: '!Or', instanceOf: Or, kind: 'sequence' },
    { name: '!Equals', instanceOf: Equals, kind: 'sequence' },
    { name: '!Join', instanceOf: Join, kind: 'sequence' },
    { name: '!Select', instanceOf: Select, kind: 'sequence' },
    { name: '!Split', instanceOf: Split, kind: 'sequence' },
    { name: '!Transform', instanceOf: Transform, kind: 'mapping' },
];
exports.CUSTOM_SCHEMA = js_yaml_1.Schema.create(customTags.map((tag) => new js_yaml_1.Type(tag.name, {
    kind: tag.kind,
    construct: (data) => {
        return new tag.instanceOf(data);
    },
    instanceOf: tag.instanceOf,
    represent: (object) => {
        switch (tag.kind) {
            case 'mapping':
                return { ...object.map };
            case 'scalar':
                return object.value;
            case 'sequence':
                return [...object.values];
        }
    },
})));
exports.parseServerlessYaml = (path) => {
    return js_yaml_1.load(fs_extra_1.readFileSync(path).toString(), {
        schema: exports.CUSTOM_SCHEMA,
    });
};
const getServerlessPath = (service) => {
    const basePath = service.getLocation();
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
        if (fs_extra_1.existsSync(src)) {
            fs_extra_1.removeSync(src);
        }
        fs_extra_1.copySync(dest, src);
    });
};
const removePlugins = (doc) => {
    const removePlugins = ['serverless-offline', 'serverless-webpack'];
    if (doc.plugins) {
        doc.plugins = doc.plugins.filter((p) => !removePlugins.includes(p));
    }
};
const optionalRegion = (doc, region) => {
    const toDelete = [];
    for (const functionName of Object.keys(doc.functions)) {
        const functionDef = doc.functions[functionName];
        if (functionDef.region && functionDef.region !== region) {
            toDelete.push(functionName);
        }
    }
    toDelete.forEach((name) => delete doc.functions[name]);
};
exports.reformatYaml = async (projectRoot, config, services, region, env) => {
    for (const service of services) {
        const { src, dest } = getServerlessPath(service);
        const doc = js_yaml_1.load(fs_extra_1.readFileSync(dest, 'utf8'), {
            schema: exports.CUSTOM_SCHEMA,
        });
        const scripts = config.getYamlTransformations(projectRoot);
        for (const script of scripts) {
            if (!fs_extra_1.existsSync(script)) {
                throw Error(`YAML Transforms: Script ${script} does not exists`);
            }
            let path;
            if (script.match(/\.ts$/)) {
                await typescript_1.compileFile(path_1.dirname(script), script, { outDir: path_1.dirname(script) }, new logger_1.Logger());
                path = script.replace(/\.ts$/, '.js');
            }
            else if (script.match(/\.js$/)) {
                path = script;
            }
            else {
                throw Error(`YAML Transforms: Script ${script} has invalid extension: not {js, ts}`);
            }
            if (!fs_extra_1.existsSync(path)) {
                throw Error(`YAML Transforms: Script ${path} does not exists`);
            }
            const transformation = require(path);
            if (typeof transformation.default !== 'function') {
                throw Error(`YAML Transforms: Default export of script must be a function @ ${script}`);
            }
            transformation.default(doc, region, env);
        }
        removePlugins(doc);
        optionalRegion(doc, region);
        fs_extra_1.writeFileSync(src, js_yaml_1.dump(doc, {
            schema: exports.CUSTOM_SCHEMA,
        }));
    }
};
exports.getServiceName = (service) => {
    const path = path_1.join(service.getLocation(), 'serverless.yml');
    if (!fs_extra_1.existsSync(path)) {
        throw Error('Error: serverless.yml not found @ ' + path);
    }
    const yaml = exports.parseServerlessYaml(path);
    return yaml.service;
};
//# sourceMappingURL=yaml.js.map