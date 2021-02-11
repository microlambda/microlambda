import { ServerlessInstance, ServerlessOptions } from "./types";
declare class ServerlessMilaOffline {
    serverless: ServerlessInstance;
    options: ServerlessOptions;
    commands: object;
    hooks: object;
    private _graph;
    private _config;
    constructor(serverless: ServerlessInstance, options: ServerlessOptions);
    private _beforeOffline;
    private _getDependenciesGraph;
    private _transpile;
}
export = ServerlessMilaOffline;
