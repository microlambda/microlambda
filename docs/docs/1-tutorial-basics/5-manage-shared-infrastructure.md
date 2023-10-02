---
sidebar_position: 5
---

# Manage shared infrastructure

Some resources need to be shared among multiple microservices and/or environments.
Provisioning them through one of the serverless templates of a microservice wouldn't be wise.
If we were to delete that service, all the resources would be destroyed, including the shared resources
(potentially used by other services as well).

Microlambda offers a simple yet effective way to manage infrastructure shared among multiple instances of microservices
(log buckets, secrets, lambdas for asynchronous middleware processing, etc.).
You just need to create special yarn workspaces whose `mila.json` files contain the `infra:deploy` and `infra:remove` targets.
Such packages are considered by Microlambda as packages used for provisioning shared infrastructure.

Before deploying the services, Microlambda will execute the `infra:deploy` script for each package in each target region where
the environment is replicated, in topological order.

Since Microlambda targets are used, the remote cache is utilized by default unless the `--force` option is provided.
As a result, between two deployment executions, shared infrastructure that has not been modified is not redeployed for
performance reasons.

You can use the `mila.json` configuration file of the workspace to explicitly specify whether an environment-specific deployment
should be performed or not.

````json
{
 "sharedInfra": { "envSpecific": true }
}
````

If the option is set to true, Microlambda will create a cache instance for each environment and pass `ENV=<env>` as an
environment variable to the runner during the execution of the `infra:deploy` and `infra:remove` scripts.

> We recommend using CloudFormation to provision these resources to maintain consistency with the rest of the project in
> terms of technologies. This is the example we provide in the base project. However, it is entirely possible to use 
> Terraform or custom scripts, as Microlambda simply executes the "infra:deploy" and "infra:remove" scripts."

