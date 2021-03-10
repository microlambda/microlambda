import { stub } from "sinon";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { deleteSecret } from "./delete-secret";

describe("[function] deleteSecret", () => {
  const deleteRequest = stub(SecretsManagerClient.prototype, "send");
  it("should delete secret", async () => {
    deleteRequest.resolves();
    await deleteSecret("local", "name");
    expect(deleteRequest.callCount).toBe(1);
    expect(deleteRequest.getCall(0).args[0].input).toEqual({
      SecretId: "name",
    });
    deleteRequest.reset();
  });
  it("should rethrow error if any", async () => {
    deleteRequest.rejects(new Error("BOOM"));
    try {
      await deleteSecret("local", "name");
      fail();
    } catch (e) {
      expect(deleteRequest.callCount).toBe(1);
      expect(e).toEqual(new Error("BOOM"));
      deleteRequest.reset();
    }
  });
});
