---
sidebar_position: 1
---
# The runner

The Microlambda runner is an essential component of the framework, and it is used under the hood by many Mila commands 
such as build or deploy.

The runner is the component responsible for executing commands within the project. In a monorepo context, it is essential
to be able to run commands in multiple workspaces and manage the order and concurrency in which they are launched.

As the project scales and includes numerous workspaces, it can be time-consuming and costly to rerun commands. A local 
caching system can help address this issue.

Finally, to ensure a pleasant development experience, it is useful to be able to monitor files and rerun commands when 
changes occur.

This is precisely the set of challenges that the Mila runner addresses.

It is important to understand how it works in order to configure it and customize caching 
behavior and the order of command execution to suit your needs.

## The targets

The runner operates by executing targets in the workspaces that contain them. These targets must be configured in the 
`mila.json` configuration files.

A target is an entry in the 'targets' object, where the key is the name used by the runner (e.g., build), and the value 
is a configuration. This configuration includes:

| Name              | Required | Description                                                                                                                                                                                                                                                                                                                                                                                                                    |
|-------------------|----------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `script` or `cmd` | **yes**  | **The command(s) or script to be executed** : indicates to the runner the task to be performed. This can either be executing a script from the package.json (if it exists) or one or more shell commands.                                                                                                                                                                                                                      |
| `src`             | no       | **Sources for the target**: specifies all the files considered as sources, and thus used by the cache system to determine whether or not it is necessary to rerun the command.                                                                                                                                                                                                                                                 |
| `artifact`        | no       | **Artifacts**: lists all the files produced by the target. Used by the cache system to verify that the outputs exist and are still valid before skipping an execution.                                                                                                                                                                                                                                                         |
| `daemon`          | no       | **Daemon**: specifies whether the command should be treated as a daemon, meaning a process that does not exit. By default, the runner considers a target as successful when it exits with a status code of 0. However, in certain cases, such as a server listening on a port, the process does not exit. In such cases, it is necessary to instruct the runner on how to consider the command as either successful or failed. |

## Topological and parallel

Once a target is defined in one or more workspaces, you can execute it using the runner CLI with the command: 
`yarn mila-runner run <target-name>`

By default, execution occurs in all packages in parallel with concurrency equal to half the available threads on the 
machine. Concurrency can be adjusted using the `-c` or `--concurrency` option to any integer value between 1 and the number 
of available threads on the machine.

Parallel mode is the default mode. However, sometimes it is necessary to execute a command while respecting the 
topological order, meaning that the command should be executed in all dependencies of a workspace before executing it for
the workspace itself.

For this purpose, the Mila runner provides a `-t` or `--topological` option that allows you to execute a build in topological 
order, i.e., from roots to leaves in the dependency tree.

The Microlambda scheduler will then schedule tasks with the highest concurrency that satisfies the topological constraints.

By default, the runner will attempt to run the target in all workspaces that contain it. However, it is possible to 
restrict the scope of the command by providing:

* The `--workspaces <comma-separated-list-of-workspace-names>` option for parallel execution. This executes the command only in the specified workspaces.

* The `--to <comma-separated-list-of-workspace-names>` option for topological execution. This executes the command only in the specified workspaces and their dependencies.

## Daemon mode and log condition

By default, the runner considers a command successful only if it completes with a status code of 0. To modify this 
behavior in order to execute processes that do not exit, you can enable daemon mode. To do this, you need to provide a 
list of log conditions.

A log condition is an object containing the following keys:

| Name      | Required | Type                      | Default  | Description                                                                                         |
|-----------|----------|---------------------------|----------|-----------------------------------------------------------------------------------------------------|
| `type`    | **yes**  | `success`, `failure`      | -        | Whether the execution should be considered as a failure or a success when the log condition is met. | 
| `stdio`   | no       | `stdout`, `stderr`, `all` | all      | Look in stdout, stderr or both                                                                      |
| `matcher` | no       | `contains`, `regex`       | contains | Check if the logs contains a substring, or if a regexp is matched                                   |
| `value`   | **yes**  | string                    | -        | The value to watch in the logs                                                                      |


Here is a configuration example:

```json
{
  "targets" : {
    "start": {
      "script": "start",
      "daemon": [
        {
          "type": "success",
          "stdio": "all",
          "matcher": "contains",
          "value": "Server listening on"
        },
        {
          "type": "failure",
          "stdio": "stderr",
          "matcher": "contains",
          "value": "Server crashed"
        }
      ]
    }
  }
}
```


