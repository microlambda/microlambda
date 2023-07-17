import { checkSecretExists } from "./check-secret-exists";
import { putSecret } from "./put-secret";
import { deleteSecret } from "./delete-secret";
import { getSecretValue } from './get-secret-value';

export const secretsManager = {
  checkSecretExists,
  putSecret,
  deleteSecret,
  getSecretValue,
}
