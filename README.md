# µlambda

Is an opinionated serverless framework that simplifies development of typescript microservices
architectures.

The project is separated in 4 different packages:

* `@microlambda/cli` A command line interface that provides tooling to easily get started.
* `@microlambda/handling` Helpers that automates repetitive tasks such as CORS configuration, build responses.
* `@microlambda/testing` Tests helpers for easy functional tests setup. 
* `@microlambda/utils` Various utils, including inter-services communication helpers. 

## Getting started

1. Clone this repo
1. Install dependencies `npm i && npx lerna bootstrap`

### Install CLI

1. Build source `cd cli && npx tsc`
2. Link binaries `npm link`
3. Test your local setup by running `mila --version` anywhere on your filesystem.

### Example repository

1. Clone [example repo](https://bitbucket.org/MarioArnt/mila-example/src)
2. Install its dependencies
3. Run the project using `mila start` 
