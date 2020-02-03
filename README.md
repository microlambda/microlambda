# µlambda

Is an opinionated serverless framework that simplifies development of typescript microservices
architectures.

The project is separated in 3 different packages:

1. `@mulambda/cli` A command line interface that provides tooling to easily get started.
2. `@mulambda/serverless-plugin` A serverless plugin to package, deploy and start the project locally watching file changes.
3. `@mulambda/helpers` Helpers that automates repetitive tasks such as CORS configuration, build responses.

## CLI

Commands:

* `mlda init`: generate a serverless typescript microservices project. Ask for
scope (e.g. @project), default runtime, default region. Generates shared packages,
types package, test helpers package, and one hello world micro-service with a functional
test example.
* `mlda start [-i --service $serviceName -p | --port 3000]`: if run in project root : start the given service, or all them
if not specified. -i option open an inquirer to select one or many services.
if run in service folder: start this service (options are ignored.
The file changes watcher is done here. (if it was done in the plugin there would be many
watchers running concurrently). Watch file changes in all the codebase. By parsing `lerna.json`
configuration file, the start command understands which services needs to be re-compiled and
restarted and restarts them.
* `mlda test [-i --service $serviceName]`: run the test for one or many
services.
* `mlda stop [-i --service $serviceName]`: stop one or many services.
* `mlda restart [-i --service $serviceName]`: restart one or many services.
* `mlda deploy $stage [-i --service $serviceName]`: Deploy one or many services. Arguments:
$stage is the targeted stage for deployment. Options: same than above.
* `mlda status -i`: display the list of services and if there are running. Option
-i allow to navigate and start/stop/restart/logs for a service. To quit logs press q.
* `mlda logs $serviceName`: display the logs for the given service.
* `mlda new $serviceName`: generates a new service (an inquirer pre-filled with default values will ask for
region, runtime, dependencies).

## Serverless plugin

Can be forked or inspired from `serverless-plugin-typescript`.

* start the project locally: compiles typescript to target runtime. Then run serverless-offline
with compiled code.
* package: package microservice code using webpack or rollup with tree-shaking to get
the smallest working zip file.

## Helpers

Forked from Thomas Ruiz's `node-serverless-helpers`.

* Simplify CORS configuration
* Build lambda API gateway responses.
Automatically sets statusCode, stringify response body etc...
* Register before and after middlewares
