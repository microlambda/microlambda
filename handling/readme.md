# Node Serverless Helpers

[![build](https://travis-ci.org/thomasruiz/node-serverless-helpers.svg?branch=master)](https://travis-ci.org/thomasruiz/node-serverless-helpers.svg?branch=master)
[![codecov](https://codecov.io/gh/thomasruiz/node-serverless-helpers/branch/master/graph/badge.svg)](https://codecov.io/gh/thomasruiz/node-serverless-helpers)
[![dependencies](https://david-dm.org/thomasruiz/node-serverless-helpers.svg)](https://david-dm.org/thomasruiz/node-serverless-helpers.svg)

Node Serverless Helpers is a package meant to make your life easier when 
developing lambda functions in NodeJS. It handles events seamlessly and adds 
useful defaults, helpers and functions to your project.

## Documentation

The documentation can be found [in the Wiki](https://github.com/thomasruiz/node-serverless-helpers/wiki).

## Usage

Install the package with npm or yarn.

```bash
npm install node-serverless-helpers
# or 
yarn add node-serverless-helpers
```

Here is a sample working code.

```javascript
// handler.js
'use strict';

const handle = require('node-serverless-helpers').handle;

module.exports.helloWorld = handle(async (event) => {
    return 'hello lambda world!';
});
```

```yaml
# serverless.yaml
service: hello-world

provider:
  name: aws
  runtime: nodejs8.10
  region: us-east-1

functions:
  hello:
    handler: handler.helloWorld
    events:
      - http:
          path: ''
          method: get
```

The important part is the `handle` function that does 3 things.

 1. Run the `init` function. You can register init handlers by calling
  the `register` function.
 2. Run the front controller. Its job is to figure out what source the 
  event comes from, and add useful middlewares to it.
 3. Run your function, and wrap the result to the expected format.

## Debug

To print useful debug logs `export NODE_SLS_HELPERS_DEBUG=*`.

## TODO

 - Global logging system
 - Implement more handlers
 - Remove all console.logs

## Licence

[ISC - Copyright 2018 Thomas Ruiz](https://github.com/thomasruiz/node-serverless-helpers/blob/master/LICENCE)
