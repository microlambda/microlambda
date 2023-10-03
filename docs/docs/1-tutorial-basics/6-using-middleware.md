---
sidebar_position: 6
---

# Using middleware

Microlambda provides a pluggable middleware system to perform generic processing across all handlers in the project.

This is very useful for tasks such as authorization, access logging, or crash reporting, for example.

The handling utilities offer three hooks to plug into before the handler processing, after it has succeeded, and when it fails

o register hooks, simply use the `before`, `after`, and `error` methods from `@microlambda/handling`.

When a handler is wrapped in the higher-order handle method, Microlambda will execute these hooks in order.

The before middleware takes an array of functions as a parameter, which receives the event triggering the Lambda and the
context as input. Therefore, it is possible to use, override, or mutate this event.

The functions registered on after also receive the result returned by the handler, and those registered on error receive
the error that was thrown.

```typescript
// TODO: Code example
```

We recommend grouping your middleware in a dedicated package such as `@my-app/middleware` so that you can use and compose them across all your microservices.

> Please note that the processing time of middleware is added to the execution time of the business logic code, thus impacting
> the response time of the Lambda function. For long or resource-intensive tasks, it is recommended to perform them 
> asynchronously by forwarding the parameters (event, result, error) to a separate Lambda function triggered manually."
