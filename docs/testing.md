# Testing microservices

> This section is about "running tests" with mila. You can find the documentation on "how to write tests" here.

By default `mila` will try to launch unit and functional tests for every service and shared package.

Unit tests should be ran in parallel and functional tests one by one.

Default testing framework when generating an app with the CLI is `jest`.

Without further configuration, by running `mila test` the following happens:

* Check dependencies are up-to-date and install missing ones if there are some.
This can be skipped using `--no-bootstrap`.

* Compiles every package with type-safe compilation unless this is explicitly skipped using flag
`--no-recompile`.

* If there is a script `pre:test` in root project `package.json` mila will run it.
You can set up here a test database or whatever you need to be done before testing.
If there is not, this step is ignored.

* For each package: if there is a script `test:unit` mila will run it. If there is not the service/package 
is ignored with a notice.

* In another child process, mila will run the npm script `test:functional` for each package if there
is one. Otherwise, tests are ignored with a notice.

## CLI arguments

* You can run only unit or functional test using `--unit` and `--functional` flags.

* You can run tests for only one package/service using `-s <service-name>`.

* You can define the maximum concurrency using `-c <number-jobs>`.

* You can combine both to run only unit tests on one package.

* By default, mila will re-compile every dependent package using type-safe compilation. If you are
sure compiled code is up-to-date you can skip it using `--no-recompile`.

## Merging coverage reports

For each tested service/package, specify you need to generate a JSON coverage report with instanbul.

With jest, you can use `"coverageReporters": ["json", /*...*/]` in config file.

Then in `.milarc` you can specify the globs of your different coverage reports.

Default values are:

```json
{
  "coverageReports": [
    "packages/*/coverage",
    "services/*/coverage/unit"
  ],
  "mergedCoverageOutDit": "./coverage",
  "mergedCoverageReportFormat": ["html", "lcov", "json"]
}
```

Mila will match every JSON coverage and produce a merged report in the given out directory.
