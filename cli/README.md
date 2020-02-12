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
