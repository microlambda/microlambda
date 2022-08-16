export const pkg = {
  name: "@org/api",
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
    "typescript": "^4.2.4"
  }
};

export const centipod = {
  "targets": {
    "lint": {
      "cmd": "../node_modules/.bin/eslint {src,test}/**/*.{ts,tsx,json,yml}",
      "src": [
        "{src,test}/**/*.{ts,tsx,json,yml}"
      ]
    },
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
