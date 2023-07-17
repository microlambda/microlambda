rm -rf /Users/mario/Code/OpenSource/mila-starter/node_modules/@microlambda
rm -rf /Users/mario/Code/OpenSource/mila-starter/node_modules/serverless-microlambda
rm -rf /Users/mario/Code/OpenSource/mila-starter/node_modules/@aws-sdk

mkdir /Users/mario/Code/OpenSource/mila-starter/node_modules/@microlambda

cp -r aws /Users/mario/Code/OpenSource/mila-starter/node_modules/@microlambda/aws
cp -r node_modules/@aws-sdk /Users/mario/Code/OpenSource/mila-starter/node_modules/@aws-sdk

cp -r core /Users/mario/Code/OpenSource/mila-starter/node_modules/@microlambda/core
cp -r environments /Users/mario/Code/OpenSource/mila-starter/node_modules/@microlambda/environments
cp -r cli /Users/mario/Code/OpenSource/mila-starter/node_modules/@microlambda/cli
cp -r client /Users/mario/Code/OpenSource/mila-starter/node_modules/@microlambda/client
cp -r config /Users/mario/Code/OpenSource/mila-starter/node_modules/@microlambda/config
cp -r errors /Users/mario/Code/OpenSource/mila-starter/node_modules/@microlambda/errors
cp -r generators /Users/mario/Code/OpenSource/mila-starter/node_modules/@microlambda/generators
cp -r handling /Users/mario/Code/OpenSource/mila-starter/node_modules/@microlambda/handling
cp -r layers /Users/mario/Code/OpenSource/mila-starter/node_modules/@microlambda/layers
cp -r logger /Users/mario/Code/OpenSource/mila-starter/node_modules/@microlambda/logger
cp -r plugin /Users/mario/Code/OpenSource/mila-starter/node_modules/serverless-microlambda
cp -r handling /Users/mario/Code/OpenSource/mila-starter/node_modules/@microlambda/handling
cp -r runner/core /Users/mario/Code/OpenSource/mila-starter/node_modules/@microlambda/runner-core
cp -r runner/cli /Users/mario/Code/OpenSource/mila-starter/node_modules/@microlambda/runner-cli
cp -r server /Users/mario/Code/OpenSource/mila-starter/node_modules/@microlambda/server
cp -r state /Users/mario/Code/OpenSource/mila-starter/node_modules/@microlambda/state
cp -r types /Users/mario/Code/OpenSource/mila-starter/node_modules/@microlambda/types
cp -r utils /Users/mario/Code/OpenSource/mila-starter/node_modules/@microlambda/utils
cp -r state /Users/mario/Code/OpenSource/mila-starter/node_modules/@microlambda/remote-state
