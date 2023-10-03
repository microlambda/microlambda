---
sidebar_position: 1
---

# Your first deploy

The first part of the documentation provides you with the keys to rapidly and productively develop a sizable serverless
application. Now it's time to deploy this application on AWS to allow your users to access it.

Microlambda offers a comprehensive suite of tools to orchestrate deployments across multiple environments (development, 
staging, production) in a multi-regional manner. Its remote cache system enables the redeployment of only the affected 
services, saving you valuable time on your operations.

## Pre-requesites

First, you need to log in to an AWS account, either via Single Sign-On (SSO) or by exporting an AWS key pair or profile.
You can verify that you are logged in to the correct account by using the AWS CLI command `aws sts get-caller-identity`.

The AWS account you are using must have sufficient privileges to create the necessary resources (buckets, IAM roles,
CloudFormation stacks, DynamoDB tables, etc.).

## Initialize remote state

Microlambda uses a remote state to keep track of every deployment.

The state consist of:
* A DynamoDB table to store currently deployed services state and handle concurrent deployment.
* A S3 bucket for remote caching, where checksums are stored to avoid re-deploying unaffected services.

You must initialize this remote state once before your first deployment using ``yarn mila init``

## Create environment

You must register on remote state the different environments of your application (e.g. `dev`, `preprod`, `prod`) .

This is mandatory to keep track of deployments history and to manage [infrastructure replication](../advanced/infrastructure-replication).

We recommend following a classic Gitflow with the following environments:

* A development environment for your team's developers to integrate and test their work.
* A staging environment for your QA team to validate the batch to be deployed in production.
* A stable production environment for your end users.

Let's create a development environment using ``yarn mila envs create dev``.

## Deploy


Now that these preliminary steps are complete, it's time to plan our first deployment 🚀.

To do this, run the command `yarn mila deploy -e dev.`

The Microlambda CLI will then compare the state of your services as recorded in the remote state with the current state 
of your codebase and resolve the deployment operations to be performed. 
It will display a table specifying the action to be taken for each service and each regional replica in order to match 
the remote service state with that of your codebase. 

These actions can be:

* `first_deploy`: if the service has never been deployed in this region before.
* `deploy`: if the service has already been deployed but its source code or that of one of its dependencies has changed.
* `no_changes`: if the code hasn't changed, and deployment can be skipped.
* `destroy`: if the service no longer exists in your codebase or if the region has been removed in state.

Once this plan is calculated, you can confirm its application and initiate the deployment of all services in parallel.

> Microlambda performs its operations in parallel, with a default concurrency level equal to half the threads of your machine. You can override this behavior with the '-c' option.

This first deployment was done from your machine to demonstrate how Microlambda orchestrates deployments. 
However, we recommend quickly setting up CI/CD pipelines to automate deployments.
You can automatically deploy your environments upon merging into the main `dev`, `staging`, and `main` branches.
You can use Microlambda in your pipeline, and we invite you to run `yarn mila deploy --help` to see the available options, including:

* `-s` to evaluate the plan and deploy only one or several services (comma-separated). Useful if you want to parallelize in multiple jobs.
* `--no-prompt`: skip confirmation, useful as we don't have stdin in CI.
* `--on-prompt`: calculate and display only the deployment plan. Useful if you want to resolve the entire plan and then apply it after review in a manual step."
