---
sidebar_position: 4
---

# Infrastructure replication

Microlambda is designed to be multi-regional and offers many tools for multi-regional infrastructure deployment.

In the remote state, each environment is configured with a default set of regions where the infrastructure should be
replicated. Therefore, with each deployment, resources are created or updated in all target regions. The Microlambda 
runner spawns a process per region and per microservice and populates the `AWS_REGION` environment variable accordingly.

These target regions are not set in stone, and it is entirely possible to evolve them over the project's lifespan.

The command `yarn mila envs create-replicate <env> <region>` allows you to create a new regional replicate. New stacks
`and shared resources will be created in the new target region.

Similarly, you can delete a replicate with `yarn mila envs destroy-replicate <env> <region>`.

> Please note that the resources in question will be destroyed after confirmation.

## Latency-based routing

Multi-regional deployments are only beneficial if you also use the [custom domains](../deployments/using-custom-domains)
feature to take advantage of latency-based routing.

When this feature is enabled, the serverless-microlambda plugin will resolve the target regions and create the necessary
DNS records in each region for latency-based routing to direct traffic to the region with the lowest latency.

## Global table

If you are using DynamoDB as your database, don't forget to create replicates at the database layer as well by enabling 
the AWS feature called Global Tables. This feature allows for automatic data synchronization between multiple regions.
