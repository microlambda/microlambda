import { checkSecretExists } from "./check-secret-exists";
import { putSecret } from "./put-secret";
import { deleteSecret } from "./delete-secret";

export const secretsManager = {
  checkSecretExists,
  putSecret,
  deleteSecret,
}
