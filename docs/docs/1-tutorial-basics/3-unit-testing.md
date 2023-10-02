---
sidebar_position: 3
---

# Unit testing

Microlambda provides utilities to unit test handlers.

The TestBed class from the `@microlambda/testing` package allows you to run an Api Gateway handler in isolation.
It provides a wide range of helpers for simulating events with path parameters, headers, or query string parameters.

Here is an example of code for testing a handler:

```typescript
import { TestBed } from '@microlambda/testing';
import { handler } from '../src/handlers/http/create-user';

describe('The create user handler', () => {
  it('should return 422 if payload is invalid', async () => {
    const testBed = new TestBed(handler);
    testBed.body({
      email: 'john.doe@company.com',
      password: 'abc',
    });
    const response = await testBed.post();
    expect(response.statusCode).toBe(422);
    expect(response.body).toEqual({
      errors: [
        { field: 'password', msg: 'Password length should be at least 8' },
      ],
    });
  });
});
```

## Manage authentication

Feel free to extend the TestBed class to add your own utilities. 

Here's an example of how to mock user authentication through an external custom authorizer Lambda by overriding the requestContext:

````typescript
import { TestBed as MilaTestBed } from '@microlambda/testing';
import { handler } from '../src/handlers/http/create-user';

class TestBed extends MilaTestBed {
  user() {
    this.authorize({ principalId: 'test.user@myapp.io', role: 'user' });    
  }
  
  admin() {
    this.authorize({ principalId: 'test.admin@myapp.io', role: 'admin' });
  }
}

describe('The create user handler', () => {
  it('should return 401 if user is not authenticated', async () => {
    const testBed = new TestBed(handler);
    testBed.body({
      email: 'john.doe@company.com',
      password: 'mySuperSecretPassw0rd!',
    });
    const response = await testBed.post();
    expect(response.statusCode).toBe(401);
  });
  it('should return 403 if user is not an admin', async () => {
    const testBed = new TestBed(handler);
    testBed.body({
      email: 'john.doe@company.com',
      password: 'mySuperSecretPassw0rd!',
    });
    const response = await testBed.user().post();
    expect(response.statusCode).toBe(403);
  });
  it('should return 200 if user is an admin', async () => {
    const testBed = new TestBed(handler);
    testBed.body({
      email: 'john.doe@company.com',
      password: 'mySuperSecretPassw0rd!',
    });
    const response = await testBed.admin().post();
    expect(response.statusCode).toBe(200);
  });
});
````

> Note: if used in many services, you should create a shared package to export your extended `TestBed`
