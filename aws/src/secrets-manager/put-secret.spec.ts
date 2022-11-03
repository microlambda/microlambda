import { stub } from "sinon";
import {
  CreateSecretCommand,
  SecretsManagerClient,
  UpdateSecretCommand,
} from "@aws-sdk/client-secrets-manager";
import * as secrets from "./check-secret-exists";
import { putSecret } from "./put-secret";

describe("[function] putSecret", () => {
  const putRequests = stub(SecretsManagerClient.prototype, "send");
  const exists = stub(secrets, "checkSecretExists");
  afterEach(() => {
    putRequests.reset();
    exists.reset();
  });
  it("should create secret if it does not already exist", async () => {
    exists.resolves(false);
    putRequests.resolves({ ARN: "$arn" });
    await putSecret("local", "$name", "$value");
    expect(putRequests.callCount).toBe(1);
    expect(putRequests.getCall(0).args[0]).toBeInstanceOf(CreateSecretCommand);
    expect(putRequests.getCall(0).args[0].input).toEqual({
      Name: "$name",
      SecretString: "$value",
    });
  });
  it("should update secret if it already exist", async () => {
    exists.resolves(true);
    putRequests.resolves({ ARN: "$arn" });
    await putSecret("local", "$name", "$value", {
      description: "this is top secret",
      kmsKeyId: "$arn",
    });
    expect(putRequests.callCount).toBe(1);
    expect(putRequests.getCall(0).args[0]).toBeInstanceOf(UpdateSecretCommand);
    expect(putRequests.getCall(0).args[0].input).toEqual({
      SecretId: "$name",
      Description: "this is top secret",
      KmsKeyId: "$arn",
      SecretString: "$value",
    });
  });
  it("should rethrow create error", async () => {
    exists.resolves(false);
    putRequests.rejects(new Error("ARGH"));
    try {
      await putSecret("local", "$name", "$value", {
        description: "this is top secret",
        kmsKeyId: "$arn",
      });
      fail();
    } catch (e) {
      expect(putRequests.callCount).toBe(1);
      expect(e).toEqual(new Error("ARGH"));
    }
  });
  it("should rethrow update error", async () => {
    putRequests.rejects(new Error("BAD-A-BOOM"));
    exists.resolves(true);
    try {
      await putSecret("local", "$name", "$value");
      fail();
    } catch (e) {
      expect(putRequests.callCount).toBe(1);
      expect(e).toEqual(new Error("BAD-A-BOOM"));
    }
  });
});
