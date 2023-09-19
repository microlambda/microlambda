---
sidebar_position: 1
---

# Getting Started

Get started by **creating a new microlambda project**.

### What you'll need

- [Node.js](https://nodejs.org/en/download/) version 16.14 or above:
  - When installing Node.js, you are recommended to check all checkboxes related to dependencies.
- [Yarn](https://yarnpkg.com/getting-started/install) Either yarn classic (1.x) ou yarn berry must be installed globally on your machine

## Generate a new project

Microlambda provides a CLI to generate a new project from scratch.

```bash
npm init microlambda
```

This command will perform the following actions :

* Create a new folder `<project-name>` in the current working directory of your terminal
* Initialize a git repository in it for our mono-repository
* Create the project boilerplate with all the configurations file, an example of shared package and a "hello-world" repository. Learn more about [project structure](./tutorial-basics/project-structure)
* Install the dependencies and configure workspaces using yarn
* Initialize remote state and lock

## Start your project

Run the development server:

```bash
cd <project-name>
yarn start
```

The `yarn start` command builds your application locally, start the serverless microservices using serverless-offline and serves a project dashboard available at `http://localhost:4545/`.

Microlambda will watch the source code and reload your app automatically on changes.

> Transpiling and typechecking processes are performed in different threads for performance reasons
