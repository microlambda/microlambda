---
sidebar_position: 1
---

# Manage environments

## Remote state

Microlambda uses a remote state to keep track of every deployment.

The state consist of:
* A DynamoDB table to store currently deployed services state and handle concurrent deployment.
* A S3 bucket for remote caching, where checksums are stored to avoid re-deploying unaffected services.

You must initialize this remote state once before your first deployment using ``yarn mila init``

## Create environment

You must register on remote state the different environments of your application (e.g. `dev`, `preprod`, `prod`) .

This is mandatory to keep track of deployments history and to manage [infrastructure replication](../advanced/infrastructure-replication).

A dedicated command is available to create a new environment in remote state.

```
> yarn mila envs create dev
```



## List environments

## Destroy environments
