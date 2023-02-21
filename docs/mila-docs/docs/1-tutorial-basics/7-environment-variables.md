# Managing Lambdas Environment

## Using dotenv

Microlambda provides a way to deal with multiple environments way easier.

It removes duplication by allowing you to inject some variables for all services and all deployed stages (dev, int, prod). While making it easier to specify a different value per stage.

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

When deploying or starting the project, the microlambda serverless plugin will automatically populate Lambda environment.

No need to maintain the environment section of serverless.yml anymore.

> This is a helper to define more conveniently environment variables scopes, but you still can use serverless.yml
environment section if you need it.

### Injecting parameters from AWS SSM

## Secrets and sensitive value

Secrets should not be injected in Lambda environment variables.

Otherwise, anyone with `lambda:DescribeFunction` IAM permission could read the secret value.

Best practice is to store secret value in a vault and inject the value in-memory of the lambda at runtime.

Microlambda provides helpers to achieve this very easily, in a way that both works in local run and on deployed
functions.

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

### How to grant Lambda execution role the permission to get secret value ?

No need.

The permission to get secret value is granted to the Lambda via the microlambda serverless plugin when packaging or
starting the project.

So you don't have to add the permissions yourself in serverless.yml IAM roles statements.

### How is the secret injected on runtime ?

In the default project middleware stack, a special command transform this special value in the secret on runtime

```typescript
export const registerMiddleware = () => {
  
}
```

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
