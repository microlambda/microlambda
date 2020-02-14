# Microlambda CLI

This project contains the Microlambda Command Line Interface `@microlambda/cli`.

## Getting started

When the package will be published on NPM registry, it will be installable like
any other package.

* Either globally `npm i -g @microlambda/cli` and runnable with `mila --version`
* Or in a project-scope: `npm i -D @microlambda/cli` and runnable with `npx mila --version`.

In the meantime, you need to:

1. Install dependencies `npm i`
2. Build source `npx tsc`
3. Link binaries `npm link`

Test your local setup by running `mila --version` anywhere on your filesystem.

## CLI

Commands:

* `mila init`: generate a serverless typescript microservices project. Ask for
scope (e.g. @project), default runtime, default region. Generates shared packages,
types package, test helpers package, and one hello world micro-service with a functional
test example.
* `mila start [-i --service $serviceName -p | --port 3000]`: if run in project root : start the given service, or all them
if not specified. -i option open an inquirer to select one or many services.
if run in service folder: start this service (options are ignored.
The file changes watcher is done here. (if it was done in the plugin there would be many
watchers running concurrently). Watch file changes in all the codebase. By parsing `lerna.json`
configuration file, the start command understands which services needs to be re-compiled and
restarted and restarts them.
* `mila test [-i --service $serviceName]`: run the test for one or many
services.
* `mila stop [-i --service $serviceName]`: stop one or many services.
* `mila restart [-i --service $serviceName]`: restart one or many services.
* `mila deploy $stage [-i --service $serviceName]`: Deploy one or many services. Arguments:
$stage is the targeted stage for deployment. Options: same than above.
* `mila status -i`: display the list of services and if there are running. Option
-i allow to navigate and start/stop/restart/logs for a service. To quit logs press q.
* `mila logs $serviceName`: display the logs for the given service.
* `mila new $serviceName`: generates a new service (an inquirer pre-filled with default values will ask for
region, runtime, dependencies).
