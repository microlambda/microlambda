# Microlambda Testing utilities

## Test bed

Test bed is a convenient helper to test API Gateway events handlers.

You can set up a test bed for your handler this way:

```typescript
import { TestBed } from '@microlambda/testing';

import { handler } from '../src/get-books.ts';

const testBed = new TestBed(handler);

const result = await testBed.pathParameters({ id: 176 }).get();

expect(result).toEqual({ title: '1984', author: 'George Orwell', /* ... */ });

```

### Using custom authorizer

TO DOCUMENT
