const slsw = require('serverless-webpack');
const nodeExternals = require('webpack-node-externals');
const path = require('path');

function resolve(dir) {
  return path.join(__dirname, './', dir);
}

module.exports = {
  resolve: {
    extensions: ['.js', '.ts', '.graphql', '.gql'],
    alias: {
      '@': resolve('/src'),
    },
  },
  output: {
    libraryTarget: 'commonjs',
    path: path.join(__dirname, '.webpack'),
    filename: '[name].js',
  },
  entry: slsw.lib.entries,
  target: 'node',
  mode: slsw.lib.webpack.isLocal ? 'development' : 'production',
  module: {
    rules: [
      {
        test: /\.ts(x?)$/,
        use: [
          {
            loader: 'ts-loader',
          },
        ],
      },
      {
        test: /\.js$/,
        loader: 'babel-loader',
        include: path.join(__dirname, './'),
        exclude: /node_modules/,
      },
    ],
  },
};
