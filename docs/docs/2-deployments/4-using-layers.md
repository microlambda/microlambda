---
sidebar_position: 4
---

# Using layers

AWS Lambda requires uploading your zipped code to S3 to execute the handlers. This bundle must include the business code
as well as all dependencies used during the handler's execution.

Microlambda ships with its own algorithm for creating the bundle. This algorithm is optimized to generate a minimal-sized 
bundle containing all dependencies, both internal and external, in a monorepo context.

While this package is optimized, it often exceeds the 3MB limit for in-console AWS editing, which is very useful for 
debugging purposes.

Furthermore, the overwhelming majority of the bundle's volume is occupied by dependencies. Therefore, recreating this
bundle for each deployment can be costly.

Microlambda offers an option to enable the use of Lambda Layers. If this option is activated, the dependencies are zipped
separately and uploaded as a layer for the function. As a result, the actual code of the Lambda is often reduced by a few 
kilobytes, allowing for editing in the console.

Moreover, it is possible not to regenerate the layer part if the dependency tree remains unchanged between two deployments,
which can save a considerable amount of time.

You can enable layers usage and layers caching in the serverless-microlambda plugin configuration:

```yaml
custom:
    packagr:
      useLayer: true # Enable layers, default: false
      checksums: true # Use layers caching, default: true
      # Additional optional configuration
      runtimes: # compatible runtimes, default: [provider.runtime]
        - nodejs16.x
        - nodejs14.x
      architecture: arm64 # compatible architecture for layer, default: x86_64
      level: 7 # compression level for zip, default: 9
      prune: 3 # number of layer versions to keep, default: Infinity
```
