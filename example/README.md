# Serverless Typescript Microservices Monorepo

## Run the project locally

Install dependencies:

`npm install && npx lerna bootstrap`

## Run tests

## Add microservice

## Add package

## Add dependency

Share dependencies between microservices by installing them in project root:

`npm i [-D] [packageName]`

Pros: 
* All packages and microservices will use the same version of the dependency. Updates
are easier
Cons: 
* The dependencies are not explicitly stated in packages/microservices package.json
* You cannot use different versions between packages/versions

Alternatively, you can install a specific version of a dependencies for a given service:

`npx lerna add [packageName@version] [--dev] [--scope microservice]`

Pros:
* Microservice uses their own version of packages and are less tightly coupled
* Every dependency is listed in package.json of each package/microservice
Cons:
* Bundle size is bigger as all versions must be shipped


