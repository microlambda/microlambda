import { createBasePathMapping } from "./create-base-path-mapping";
import { createCustomDomain } from "./create-custom-domain";
import { deleteBasePathMapping } from "./delete-base-path-mapping";
import { deleteCustomDomain } from "./delete-custom-domain";
import { getBasePathMapping } from "./get-base-path-mapping";
import { getCustomDomain } from "./get-custom-domain";
import { updateBasePathMapping } from "./update-base-path-mapping";

export const apiGateway = {
  createCustomDomain,
  createBasePathMapping,
  deleteCustomDomain,
  deleteBasePathMapping,
  getBasePathMapping,
  getCustomDomain,
  updateBasePathMapping,
};
