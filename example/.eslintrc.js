module.exports = {
    "parser": "babel-eslint",
    "parserOptions": {
        "ecmaVersion": 6,
        "sourceType": "module",
        "ecmaFeatures": {
            "modules": true,
            "experimentalObjectRestSpread": true
        }
    },
    extends: ['eslint:recommended', 'google'],
    rules: {
        'max-len': [
            1,
            {
                code: 120,
            },
        ],
        'require-jsdoc': 0,
        'no-var': 0,
        'space-before-function-paren': [
            'error',
            {
                anonymous: 'always',
                named: 'never',
                asyncArrow: 'ignore',
            },
        ],
        'no-throw-literal': 0,
    },
    env: {
        node: true,
        es6: true,
    },
};
