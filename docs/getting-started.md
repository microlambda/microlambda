# Getting started

## Prerequisites

Before creating a project, you should open a terminal and log in AWS.

The CLI will determine the AWS project ID and the default region based on the user currently logged in the terminal executing the create project command.

If you are not logged, it is possible to proceed anyway, but some feature as Microlambda remote state will  not be setup automatically.

To scaffold a new project, the IAM user you are 

```json
  {
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CreateChecksumsBucket",
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::my-app-mila-checksums"
    }
  ]
}
```

## Create a new project

The easiest way to create a new Microlambda project is by using the CLI :

```bash
npx mila@latest new <project-name>
```

The CLI will create a directory, initialize a git repository in it, create all the boilerplate and install dependencies.

> **Important** : the project name you choose will be used as NPM scope for the packages name of the project. If you want to publish shared librairies on the public you must choose a NPM scope you own as project name.

Once the command exited successfully, you can start the project locally using simply ``yarn start``

By default, two environments are created ``dev`` and `prod`.

You can deploy them to AWS using ``yarn mila deploy -e <env>``.
