---
sidebar_position: 2
---

# Understand caching

One of the main strengths of the Microlambda runner is its caching system, which saves time and resources by re-executing
targets only when necessary

## Local and remote caching

By default, the local cache is used. The local cache stores checksums of sources and artifacts in hidden folders on the
filesystem of the machine that launches the process. During the next execution of a target, if the current checksums match
the stored checksums, the command is not rerun.

It is possible to bypass this cache by using the `--force` option.

You can also use a remote cache on AWS S3 to share it among multiple workers and distribute the workload. To do this,
simply use the `--remote-cache` option. The bucket and region to be used will be those specified in the root configuration
file mila.json. The checksums of the target will be stored at the path `caches/<workspace-name>/<cmd-name>`. The artifacts
will also be uploaded to this path. During the next execution, if there is a cache hit, they will be downloaded, and
everything will proceed as if the command had actually been executed on the worker.

## Configure caching

In the configuration of the targets in the mila.json file, it is necessary to inform the runner about the inputs and
outputs of the command to be executed. This way, it can check whether the inputs, i.e., the sources, of a target have
not been modified, and whether the artifacts produced by a target, i.e., its outputs, are still present and valid.

> This is a declarative process, and it is important to keep these lists of inputs and outputs up to date to ensure that 
the behavior is as expected and that the cache is invalidated when necessary.

You can configure all the files to be considered as sources or inputs using a combination of one or more of the following three glob arrays:

* An array of globs relative to the root of the workspace.
* An array of globs relative to the root of all dependencies.
* An array of globs relative to the root of the project.

Artifacts, on the other hand, are configured with a single array of globs relative to the root of the workspace.

Here is an example configuration to illustrate this:

```json
{
  "targets": {
    "build": {
      "script": "tsc",
      "src": {
        "internals": [
          "src/**/*.ts",
          "tsconfig.json"
        ],
        "deps": [
          "src/**/*.ts",
          "tsconfig.json"
        ],
        "root": [
          "tsconfig.json"
        ]
      },
      "artifacts": [
        "lib/**/*.js",
        "lib/**/*.d.ts",
        "dist/**/*.js",
        "dist/**/*.d.ts"
      ]
    }
  }
}
```

The build target will be rerun if:

* Its own typescript sources change ``src/**/*.ts``.
* Its own `tsconfig.json` change.
* One of the typescript source or a `tsconfig.json` of any of its dependencies change.
* The project main `tsconfig.json` changed, as other configs extends it.
* The produced artifacts ``*.js`` and ``.d.ts`` files have changed or do not exists anymore
