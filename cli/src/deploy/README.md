# Deployment scripts

These scripts deploy the data portal to AWS.

The workflow is basically the following:

1. Bootstrap dependencies
2. Compiling shared packages
3. Compiling microservices
4. Packaging microservices
5. Transforming the services YAML on the fly (e.g. use different authorizers, disable plugins...)
6. Deploying microservices

## No config

If there is no specific configuration, each service is deployed at the same time.

They are deployed in the region corresponding to the AWS_REGION environment variable.


## Using a configuration file

You can add a deployment configuration to enable custom domains, control the order of deployments and deploy services
in multiple regions.

### Deployment steps

By default, all services are deployed at the same time. 

If you have different requirements like deploying some services before others, you can specify 
deployment steps.

Typically if you are using a custom authorizer, you want to deploy it before the services using it.

To achieve this, specify the steps of deployment in the `.deployrc` configuration file.

```json
{
  "steps": [
    ["customAuthorizer"],
    ["service1", "service2", "service3"]
  ]
}
```

All services within a same step are deployed concurrently.
Steps are deployed sequentially, in the order where they are declared.

Here `customAuthorizer` will be deployed first.
Then services 1, 2 and 3 will be deployed concurrently.

You can use *one* wildcard `*` meaning "every other services".

```json
{
  "steps": [
    ["customAuthorizer"],
    ["service1", "service2", "service3"],
    "*",
    ["final-service"]
  ]
}
```

Here `customAuthorizer` is deployed first, second service 1, 2, 3.
Then every service that is not elsewhere in config.
And finally `final-service`

### Geo-replication

The improve latency and performance worldwide, you can either:

* Use Edge Optimized API Gateways (this the default behavior)
* Replicate Regional API Gateway in different regions.

To enable the second option, with regional API use:

```json
 {
   "defaultRegions": [
      "eu-west-1",
      "us-east-2"
   ]
 }
```

#### Geo-replication by services

If you want more fine-grained regional options, use deployment steps to
specify target regions services by services.

```json
{
  "regions": {
    "service1": ["eu-west-1"],
    "service2": ["eu-west-1", "us-east-1", "ap-southeast-1"],
    "service3": ["eu-west-1"]
    /* ... */
  }
}
```

#### Geo replication by environment

You can also customize regional options environment by environment.

Either for all services:

```json
{
  "defaultRegions": {
    "dev": ["eu-west-1"],
    "staging": ["eu-west-1"],
    "prod": ["eu-west-1", "us-east-1", "ap-southeast-1"]
  }
}
```

Or services by services:

````json
{
  "regions": {
    "service1": {
        "dev": ["eu-west-1"],
        "staging": ["eu-west-1"],
        "prod": ["eu-west-1"]
    },
    "service2": {
        "dev": ["eu-west-1"],
        "staging": ["eu-west-1"],
        "prod": ["eu-west-1", "us-east-1", "ap-southeast-1"]
    }
    /* ... */
  }
}
````

#### Priority

The fine-grained settings service-by-service take precedence on `defaultRegion`.

Example:

````json
{
  "defaultRegions": {
    "dev": ["eu-west-1"],
    "staging": ["eu-west-1"],
    "prod": ["eu-west-1", "us-east-1", "ap-southeast-1"]
  },
  "regions": {
    "service1": {
      "prod": ["eu-west-1"]
    }
  }
}
````

Every service will be deployed to "eu-west-1", "us-east-1", "ap-southeast-1" in production, except
service that have a more precise rule and will be deployed only in eu-west-1.

### Custom domains

You can use custom domains for services

Do not forget to install serverless-custom-domain plugin and fill the serverless.yml accordingly

Like above, you can define custom domain service by service

```json
{
  "domains": {
    "service-1": "service-1.my-api.io",
    "service-3": "service-3.my-api.io"
  }    
}
```

You can even use different custom domain by environment:

```json
{
  "domains": {
    "service-1": {
      "dev": "dev.service-1.my-api.io",
      "staging": "staging.service-1.my-api.io",
      "prod": "service-1.my-api.io"
    },
    "service-3": "service-3.my-api.io"
  }    
}
```

### Reformatting serverless.yml

Sometime you may want to change serverless.yaml before deploying, in order to use a slightly 
different config locally than in cloud.

To do so, register transformation functions in the config file.

These method take in parameters the object parsed from yaml and must return the modified object
to dump in yaml.

In can be either written in typescript or javascript.

```json
{
  "yamlTransforms": [
    "scripts/yaml/change-custom-authorizer",
    "scripts/yaml/region-conditional-resources"
  ]
}
```

You can see [example here](TODO gist)

