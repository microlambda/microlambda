module.exports = {
    'roots': [
        '<rootDir>/src',
    ],
    'transform': {
        '^.+\\.tsx?$': 'ts-jest',
    },
    'setupFilesAfterEnv': ['jest-extended'],
    'coverageDirectory': 'coverage',
    'testRegex': '(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$',
    'moduleFileExtensions': [
        'ts',
        'tsx',
        'js',
        'jsx',
        'json',
        'node',
    ],
};
