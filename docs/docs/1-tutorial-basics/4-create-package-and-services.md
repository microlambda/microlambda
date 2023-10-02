---
sidebar_position: 4
---

# Create a new package

You can set a new package up very easily by using the base project blueprint.

```txt
> yarn mila generate package

🧙 Microlambda code generator
? Your package name maths-utils
? Describe briefly your package Mathematics helpers for my awesome projet
```

## Usage

Now you can import the package in others packages/services.
For instance in ``services/geolocation/package.json``, add the dependency to the manifest.

```json
{
  "dependencies": {
    "@my-app/maths-utils": "workspace:*"
  }
}
```

Run a ``yarn install`` to link the workspaces and import directly the new dependency to use it.

For instance in `services/geolocation/src/utils/convert-coordinates.ts`

```typescript
import { radianToDegrees } from '@my-app/maths-utils';

export const convertCoordinates = () => {
  // Do some stuff
}
```


# Create a new Microservice

You can set a new microservice up very easily by using the base project blueprint.

```txt
> yarn mila generate service

🧙 Microlambda code generator
? Your service name users
? Describe briefly your service Manage my awesome platform users
```

> Even if it is theoretically possible, you should not import a services in another package/service

## Assign a port for local run

You can assign a port for local run in the generated service ``mila.json``.

```json
{
  "extends": "../../mila.shared.json",
  "port": 3003
}
```

> This is optional and helps you launch the serverless offline process on a predictable port
