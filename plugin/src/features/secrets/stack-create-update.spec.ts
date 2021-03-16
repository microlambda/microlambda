import { ISecretConfig } from "../../config";

export const secrets: ISecretConfig[] = [
  {
    name: "$secret1",
    value: "$topSecret",
    env: "SECRET_1",
  },
  {
    name: "$secret2",
    value: "$superSecret",
    description: "My awesome description",
    env: "SECRET_2",
  },
  {
    name: "$secret3",
    value: "$superSecret",
    kmsKeyId: "arn://my-kms-key",
    env: "SECRET_3",
  },
  {
    name: "$secret4",
    value: "$superSecret",
    description: "My awesome description",
    kmsKeyId: "arn://my-kms-key",
    env: "SECRET_4",
  },
];

describe("[function] stackCreate", () => {
  it.todo("should create/update secrets concurrently");
  it.todo("should throw if any secret creation/update fails");
});
