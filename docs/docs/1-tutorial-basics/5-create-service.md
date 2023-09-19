---
sidebar_position: 5
---

# Create a new Microservice

You can set a new microservice up very easily by using the base project blueprint.

```txt
> yarn mila generate service

🧙 Microlambda code generator
? Your service name users
? Describe briefly your service Manage my awesome platform users
```



You can assign a port for local run in the generated service ``mila.json``.

```json
{
  "extends": "../../mila.shared.json",
  "port": 3003
}
```



> This is optional and helps you launch the serverless offline process on a predictable port
