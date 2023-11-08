---
sidebar_position: 1
---

# Project structure

Microlambda propose a codebase organization for multiple serverless micro-services that facilitate code re-use.

It uses workspaces to import shared packages in multiple services without publishing on a distant registry (mono-repository approach).

## Microservices

Microlambda consider that every workspace which has a `serverless.yml` at its root is a service.

Other workspaces are considered shared packages, basically libraires containing utils or shared business logic, and that can be imported in other workspaces..

On the base project, generate with ``npm init microlambda``, the services are located in `<project-root>/services` directory.

Every microservice contains an AWS serverless REST API project using API Gateway and AWS Lambda, using the serverless framework under the hood.

You can use any serverless framework feature, please check out the [official documentation](https://www.serverless.com/framework/docs) to learn more about the different handlers and capabilities
serverless offers.

## Packages

Libraries are located in `<project-root>/packages` directory. It can be used to share code between services. 

If you need to factorize code used in many services, you can create a dedicated package.
Doing so, you do not repeat yourself, and when fixing a bug or adding a feature, every services using it
benefit of the update.

Typically, you may want to create shared packages for:

* logging
* authentication
* authorizer
* middleware
* layers of abstraction on external APIs 
* ...

These packages are publishable on a distant registry to be used on other project.

## Shared infrastructure

Each serverless service is linked a CloudFormation stack under the hood.

This stack is used to manage as code the underlying infrastructure, such as API gateways, Lambdas, IAM roles and so on.

However, the stack have (sort of) the ownership of the resources.

This means that if you want to create a resource within a service (lets say a S3 bucket) and use it in other services, you will not be able
to delete the first stack in the future, or the resources will not exist anymore for other stacks using it.

The best practices for provisioning a resources shared between many services it to use a dedicated cloudformation stack.

This way, services become more loosely coupled, and you can delete services independently the one the others.

On default project, shared infrastructure is located in `<project-root>/infra/shared`.

An example is provided for the AWS lambda code deployment bucket (a unique bucket is used across microservices to avoid hitting the 300 buckets limits by account).

## Blueprints

Microlambda offers code generation capabilities.

We consider that no one knows better than you what you need as boilerplate code.

So your team should manage how code should be generated.

To achieve that we use blueprints. Blueprints are templates which are versioned and maintained with the codebase.

It can be used to generate a new service, a new handler or any piece of code the way you want.

Use them to accelerate your team work, and enforce best practices by generating example configurations, unit tests examples...

Learn more about blueprint in the [dedicated documentation section](../advanced/customize-blueprints).
