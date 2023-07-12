# Managing Lambdas Environment

## Using dotenv

Microlambda provides a convenient way to deal with environment variables and secrets in a large scale project, with multiple environments and multiple services.

It removes duplication by allowing you to inject some variables for all services at all stages (dev, int, prod).

**And** allows you to add/overwrite values per stage only at environment or service level.

You just need to define the variables in the correct dotenv file, according to the variables scope (global, only for a micro-service, an environment).

Here is the dotenv files organization:

```text
| envs/ # Contains the root environment, shared between services
|--.env         # Env shared between services and stages
|--.env.local   # Env shared between services for a given stage
|--.env.dev
|--.env.prod
| services/
|-- hello-world/
|-- src/
|-- envs/
|---- .env           # Env only used for a service and all stages
|---- .env.local     # Env only used for a service and a given env
|---- .env.dev
|---- .env.prod
```

> Just like dotenv, if the value already exists in your environment process when deploying or running in local, it will be used instead the one specified in dotenv file.

When deploying or starting the project, the microlambda serverless plugin will automatically populate Lambda environment.

> If a variable with the same key is defined in more than one dotenv file, the **most specific take precedence**.
> The precedence order is the following (from least precise to most, the next value take precedence on previous): 
> * main dotenv in ``env/.env``
> * main environment-specific dotenvs ``env/.env.<env-name>``
> * service-specific dotenvs ``services/<service-name>/envs/.env``
> * Environment-specific and service-specific dotenvs ``services/<service-name>/envs/.env.<env-name>``

You do not need to maintain the environment section of serverless.yml anymore.

> This is a helper to define more conveniently environment variables scopes, but you still can use serverless.yml
environment section if you need it.

### Injecting parameters from AWS SSM

You can use a special syntax to inject values from SSM in dotenv files.

```text
MY_LOOSELY_COUPLED_PARAM=${ssm:my-secret-name:secret-version}
```

This allows you to update the value for many services without redeploying which is a best practice for loosely coupled system.

Microlambda default middleware stack will interpolate the value on runtime in both local and deployed lambdas.

## Secrets and sensitive value

Secrets should not be injected in Lambda environment variables.

Otherwise, anyone with `lambda:DescribeFunction` IAM permission could read the secret value.

Best practice is to store secret value in a vault and inject the value in-memory of the lambda at runtime.

Microlambda provides helpers to achieve this very easily, in a way that both works in local run and on deployed
functions.

### The secrets already exists in AWS Secret Manager Vault

In your dotenv file, you just have to use this special syntax:

```text
MY_SUPER_SECRET=${secrets:my-secret-name:secret-version}
```

The microlambda framework will take care of everything, including:

* Inject the secret **value** in the environment variable on local run
* Inject the secret **ARN** in deployed lambdas environment variables
* Grant deployed lambda IAM permission to decipher secret value
* Replace secret ARN with secret value in Lambda environment on runtime (in-memory, with a built-in ``before`` middleware).

> **Important:** If you are using infrastructure replication capabilities, make sure your secret is available in every region you target environment is deployed on.

> Notice: For the local run, the `defaultRegion` specified in your `mila.json` configuration will be used as target region for AWS Secret Manager.

### How to grant Lambda execution role the permission to get secret value ?

No need.

The permission to get secret value is granted to the Lambda via the microlambda serverless plugin when packaging or
starting the project.

So you don't have to add the permissions yourself in serverless.yml IAM roles statements.

### How is the secret injected on runtime ?

In the default project middleware stack, a before middleware will replace secret ARN by secret value on the target environment variable key.

### Should I version my secrets ?

It depends.

If it does (or not) not make sense that the previous value is used when you redeploy from a previous state (e.g. from a previous git commit for a rollback).

For instance, if you are consuming an API and the key is rotated, you want the key to be rotated also in previous version. In this case do not version.

In another scenario where you are using API v1 with a secret key and change to API v2 with another secret key, you might want to version the secret, or simply use a different environment variable name.

### You want to create a new secret

You can use the command ``yarn mila secrets add`` to add a secret.

```text
> yarn mila secrets add
Please select the secret scope
[X] global
[ ] service-specific
 Please select the environment
[X] all environments
[ ] a specific environment
Select a key for the secret in process.env
MY_SUPER_SECRET
Enter a name for your secret
my-awesome-app/shared/super-secret
Enter a value for your secret
*********
```

The secret is created and replicated in all regions were the target lambdas are deployed.

The special value is injected in the correct dotenv

```text
MY_SUPER_SECRET=${secrets:my-awesome-app/shared/super-secret}
```

> You can do this process manually, by creating the secret with the AWS CLI or in AWS Console. In this case, do not forget
> to replicate the secret in all AWS regions it is consumed

### Update secret value

You can use the command ``yarn mila secrets update MY_SUPER_SECRET`` to update the secret value.

You may need to specify the scope of the secret using ``-e`` and `-s` flags.

`yarn mila secrets update -e dev -s awesome-service MY_API_SECRET_KEY`.

With this command, the value will be updated in AWS Secrets Manager in all required regions.

### Delete secret

You can use the command ``yarn mila secrets delete MY_SUPER_SECRET`` to delete secret.

You may need to specify the scope of the secret using ``-e`` and `-s` flags.

`yarn mila secrets delete -e dev -s awesome-service MY_API_SECRET_KEY`.

With this command, the value will be deleted in AWS Secrets Manager in all required regions and removed from the correct
dotenv file.
