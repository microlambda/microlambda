Environment

k1: dev
k2: env
current: $sha1
last_deployed: datetime
services: number;
status: 'success' | 'failure'
default_regions: [eu-west-1, ap-southeast-2]

Service

k1: @my-app/service
k2: services|$env
k3: services
env: dev
current: $sha1
current_checksums: s3://
last_deployment: pk
last_deployed: datetime
status: 'success' | 'failure'
regions: [eu-west-1, ap-southeast-2]
precedence: 0

Service instance

k1: @my-app/service
k2: services|$env
k3: services
env: dev
current: $sha1
current_checksums: s3://
last_deployment: pk
last_deployed: datetime
status: 'success' | 'failure'
regions: [eu-west-1, ap-southeast-2]
precedence: 0

Deployment

k1: uuid
k2: deployments
k3: $env|$service|$region
k4: $service
started_at: datetime
terminated_at: datetime
env: dev
service: $service
current: $sha1
status: 'success' | 'failure'
region: eu-west-1
trigger: manuel | branch
took: number
logs: s3://
checksums: s3://
layer_checksum: s3://

GS0: k1/k2
GS1: k2/k1
GS2: k3/k2
GS3: k4/k2

listEnv => GS1 sk=env
describeEnv($env) => GS0 pk=$env/sk=env
listServices($env) => GS1 => sk=services|$env
describeServices($service) => GS3 => ak=services
describeServices($env, $service) => GS3 => sk=services|$env
listDeployments($service) => GS4 => service=$service/sk=deployments
listDeployments($env, $service) => GS4 => service=$service/sk=deployments
describeDeployment($env, $service, $region) =>
