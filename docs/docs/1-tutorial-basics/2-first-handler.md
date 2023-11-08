---
sidebar_position: 2
---

# Write your first handler

On serverless project, AWS Lambda is used to handler events call triggers.

A wide diversity of triggers exists:

* A HTTP call is performed on API Gateway
* A file is uploaded on a S3 bucket
* A periodic CRON trigger
* And many more...

## Simple handler

To write an AWS Lambda handler in typescript you must export a function that receive the event
passed from trigger, do some processing and optionally respond a answer.

The boilerplate depends on the trigger nature, but here is an example for an API Gateway POST API call:

```typescript
import {APIGatewayEvent} from "aws-lambda";
import {vaildatePayload, saveInDatabase} from './helpers';

export const handler = async (event: APIGatewayEvent) => {
  // Parse POST request payload from event
  const payload = JSON.parse(event.body);
  // Verify that event is valid using joi or a simmilar library
  vaildatePayload(payload);
  // Save in database
  const uuid = await saveInDatabase(payload);
  // Return response object for API Gateway, the format can be found in AWS docs
  return {
    statusCode: 201,
    body: JSON.stringify({ id: uuid }),
  };
};
```

This code works, but there are a few issues microlambda helps to solve:

* If something throws in the handler, it will crash and no response will be given. The API gateway will answer ``502`` ultimately.
* You must parse, validate and serialize the request and response payload yourself
* No CORS configuration is used here. If you want to enable cross-origin resource sharing you must add yourself the correct headers in *every* handler.

## Using @microlambda/handling

Microlambda provides utilities to write API Gateway handlers faster.

The package ``@microlambda/handling`` exports a second-order function that can be used to wrap you handler implementation.

It will automatically:

* Try / catch the whole function body. If something fails unexpectedly, it will log the error on Cloudwatch and correctly answer ``500 - Internal Server Error`` instead of crashing.
* Parse request body from JSON into Javascript Object.
* You can return only `void` or the object value of the response body. The status code will be automatically set and the response serialized to JSON. If you need to overwrite defaults, you can still return the `{ statusCode: number, body: string}` object expected by AWS API Gateway.

Here is the same example than above, updated with microlambda helpers:

```typescript
import {handle} from '@microlambda/handling';
import {APIGatewayEvent} from "aws-lambda";

export const handler = handle(async (event: APIGatewayEvent) => {
  vaildatePayload(event.body);
  const uuid = await saveInDatabase(event.body);
  return { id: uuid };
});
```

### Automatic response code

* `200 (OK)`: If the request is not a POST request and wrapped functions returns something other than ``void``
* `201 (Created)`: If the request is a POST request
* `204 (No Content)`: If the request is not a POST request and wrapped functions returns `void`

### CORS Configuration

You can use the ``config`` method to set default CORS/headers

```typescript
import { config } from '@microlambda/handling';

config({ cors: true });

export const handler = handle(async () => {
  return 'Hello world ! (with CORS headers)';
});
```

The CORS option can be either a boolean, to enable default CORS headers, or either an object to set custom CORS headers.

| Header                        | Default value                                                    | JSPath in config     |
|-------------------------------|------------------------------------------------------------------|----------------------|
| `Access-Control-Allow-Origin`   | Request origin                                                   | `cors.origin`        |
| `Access-Control-Allow-Methods`  | `['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']`   | `cors.methods`       |
| `Access-Control-Expose-Headers` | All response headers                                             | `cors.exposeHeaders` |
| `Access-Control-Allow-Headers` | All request headers                                              | `cors.allowHeaders`  |

### Middleware

Wrapping your handlers in ``handle`` function also enable microlambda middleware.

Learn more about in the [dedicated section](./using-middleware)
