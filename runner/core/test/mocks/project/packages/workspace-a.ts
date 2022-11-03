export const pkg = {
  name: "@org/workspace-a",
  version: "2.3.1",
  description: "Mocked project used for unit testing",
  author: "Mario Arnautou",
  license: "MIT",
  dependencies: {
    "lodash.isequal": "4.5.0",
  },
  devDependencies: {
    "typescript": "^4.2.4"
  }
};

export const centipod = {
  "targets": {
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
    },
    "foo": {
      "cmd": [
        "npm run foo"
      ],
      "src": {
        'internals': [
          'src/**/*.ts',
          'test/**/*.ts'
        ],
      },
    },
    "bar": {
      "cmd": [
        "npm run pre:test",
        'npm run test'
      ],
      "src": {
        'internals': [
          'src/**/*.ts'
        ],
      },
    }
  }
}
