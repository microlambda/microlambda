export const pkg = {
  name: "@org/app-b",
  version: "2.3.1",
  description: "Mocked project used for unit testing",
  author: "Mario Arnautou",
  license: "MIT",
  dependencies: {
    "@org/workspace-a": "workspace:*",
    "@org/workspace-b": "workspace:*",
    "execa": "^5.0.0",
    "fast-glob": "^3.2.5",
    "hasha": "5.2.2",
    "lodash.isequal": "4.5.0",
  },
  devDependencies: {
    "@org/api": "workspace:*",
    "typescript": "^4.2.4"
  }
};

export const centipod = {
  "targets": {
    "start": {
      "script": "start",
      "daemon": {
        "type": "success" as const,
        "stdio": "all" as const,
        "matcher": "contains" as const,
        "value": "Server ready"
      },
      "src": {
        "internals": [
          ".env",
          ".env.local",
          "serverless.yml"
        ],
        "root": [
          ".env",
          ".env.local"
        ]
      }
    },
    "lint": {
      "cmd": "../node_modules/.bin/eslint {src,test}/**/*.{ts,tsx,json,yml}",
      "src": {
        'internals': [
          '{src,test}/**/*.{ts,tsx,json,yml}',
        ],
      },
    },
    "build": {
      "cmd": [
        "../node_modules/.bin/tsc --build"
      ],
      "src": {
        'internals': [
          'src/**/*.ts',
        ],
      },
    },
    "test": {
      "cmd": [
        "../node_modules/.bin/tsc --build"
      ],
      "src": {
        'internals': [
          'src/**/*.ts',
        ],
      },
    }
  }
}
