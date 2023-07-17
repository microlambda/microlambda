import {apiGateway} from './api-gateway';
import {certificateManager} from './certificate-manager';
import {cloudformation} from './cloudformation';
import {iam} from './iam';
import {lambda} from './lambda';
import {route53} from './route53';
import {s3} from './s3';
import {secretsManager} from './secrets-manager';
import {dynamodb} from './dynamodb';
import {ssm} from './ssm';

export const aws = {
  apiGateway,
  certificateManager,
  cloudformation,
  dynamodb,
  iam,
  lambda,
  route53,
  s3,
  secretsManager,
  ssm,
}
