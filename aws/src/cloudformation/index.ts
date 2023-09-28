import { getApiId } from './get-api-id';
import {deployStack} from "./deploy-stack";
import {removeStack} from "./remove-stack";

export const cloudformation = { getApiId, deployStack, removeStack };
