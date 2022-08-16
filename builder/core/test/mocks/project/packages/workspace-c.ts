export const pkg = {
  name: "@org/workspace-c",
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
    "build": {
      "cmd": [
        "../node_modules/.bin/tsc --build"
      ],
      "src": [
        "src/**/*.ts"
      ]
    },
  }
}
