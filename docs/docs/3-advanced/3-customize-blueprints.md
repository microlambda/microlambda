---
sidebar_position: 3
---

# Customize blueprints

n order to improve the productivity of your team, we have designed a code generation system that is as adaptable as possible.

We believe that no one knows your needs better than your team, and that these needs can evolve.

Therefore, our code generation system relies on blueprints that are versioned along with the rest of the codebase, can
be customized by your team, and evolve with your project."

## Create your own blueprints

The blueprints should be placed in the `/blueprints` directory at the root of the project. To create a new blueprint,
you need to create a new sub-folder that contains:

* A metadata file `blueprint.yml`, with a name, description, and a destination folder relative to project root.
* EJS templates to be copied. The folder structure will be preserved relatively to the destination folder configured in the metadata.
* An array of Inquirer questions that allow you to request inputs from the user. The provided answers will be passed as inputs to the EJS templates during copying.
* A post-processing file to execute tasks after copying, such as writing to existing files, running commands, etc.

> We plan to release a blueprint generator ``yarn mila generate blueprint`` in next release

## Installable blueprints

We are currently working on a system of installable blueprints via NPM to allow the community to
exchange microservices design patterns, such as authentication, websockets, CQRS patterns, etc...
