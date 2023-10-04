<h1 align="center">Microlambda</h1>
<p align="center">
  <img width="150" height="150" src="https://raw.githubusercontent.com/microlambda/.github/e6430357d33bcadea731c5979c5f837afb6a9d8f/logo-blue.svg" alt="Logo"/>
</p>

Is an opinionated framework that simplifies development of AWS serverless microservices
project using typescript.

## Sponsors

<a href="https://github.com/neoxia">
    <p align="center">
        <img width="50" height="50" src="https://avatars.githubusercontent.com/u/1021573?s=50" alt="Logo"/>
    </p>
    <p align="center">
        Neoxia - The 360 Cloud Company
    </p>
</a>

## User documentation

A complete user guide is available on our [official website](https://microlambda.dev)

## Developer documentation

The project is maintained as a monorepo (using yarn workspaces) and contains the following packages:

* `@microlambda/core` Core package that contains all low-level logic to run microlambda projects.
* `@microlambda/cli` A command line interface that provides tooling to generate, run, test and deploy projects.
* `@microlambda/generator` A command line interface that provides tooling to generate, run, test and deploy projects.
* `@microlambda/client` The web UI to monitor and interact with the microservices during local runs.
* `@microlambda/server` The WebSocket server that send data to client and handle its requests for local run UI.
* `@microlambda/handling` Helpers that automates repetitive tasks such as CORS configuration, build responses.
* `@microlambda/testing` Tests helpers for easy unit and functional tests setup. 
* `@microlambda/plugin` Serverless framework plugin that enable custom domain creation and multi-regions deployments. 
* `@microlambda/docs` Project documentation website. Powered by docusaurus.

### Project first build

```bash
# Clone this repository
git clone git@github.com:microlambda/microlambda.git

# Install dependencies
yarn

# Mila is designed to build itself, to do so, build mila-runner
yarn build:runner

# Once the runner is built, use it to build the entire project
yarn build --watch
```

To perform tests, fork the [mila-starter](https://github.com/microlambda/mila-starter) or use one of your microlambda project.

Update your ``package.json`` to use yarn `link:` special protocol and use your local version of mila and run `yarn install`.

```json
{
  "dependencies": {
    "@microlambda/cli": "link:/path/to/your/clone/microlambda/cli",
    "serverless-microlambda": "link:/path/to/your/clone/microlambda/plugin"
  }
}
```

With this setup, you are using a local version of microlambda which is rebuilt with `build --watch` on another shell.

When you edit microlambda, changes are immediately available on your test project.

You have a proper DX to fix yur bug or develop your feature :triangular_ruler: 

