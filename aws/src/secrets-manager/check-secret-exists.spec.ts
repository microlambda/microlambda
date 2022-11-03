import { stub } from "sinon";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { checkSecretExists } from "./check-secret-exists";

describe("[function] checkSecretExists", () => {
  const listPage = stub(SecretsManagerClient.prototype, "send");
  it("should return true if secret exists", async () => {
    listPage.resolves({
      NextToken: "foo",
      SecretList: [{ Name: "$name" }],
    });
    expect(await checkSecretExists("local", "$name")).toBe(true);
    expect(listPage.callCount).toBe(1);
    expect(listPage.getCall(0).args[0].input).toEqual({ NextToken: undefined });
    listPage.reset();
  });
  it("should return true if secret exists on second page", async () => {
    listPage.onCall(0).resolves({
      NextToken: "foo",
      SecretList: [],
    });
    listPage.onCall(1).resolves({
      SecretList: [{ Name: "$name" }],
    });
    expect(await checkSecretExists("local", "$name")).toBe(true);
    expect(listPage.callCount).toBe(2);
    expect(listPage.getCall(0).args[0].input).toEqual({ NextToken: undefined });
    expect(listPage.getCall(1).args[0].input).toEqual({ NextToken: "foo" });
    listPage.reset();
  });
  it("should return false if secret does not exists on any page", async () => {
    listPage.onCall(0).resolves({
      NextToken: "foo",
      SecretList: [],
    });
    listPage.onCall(1).resolves({
      SecretList: [{ Name: "$other" }],
    });
    expect(await checkSecretExists("local", "$name")).toBe(false);
    listPage.reset();
  });
  it("should throw if something wrong happen when fetching any page", async () => {
    listPage.onCall(0).resolves({
      NextToken: "foo",
      SecretList: [],
    });
    listPage.onCall(1).rejects(new Error("BOOM"));
    try {
      expect(await checkSecretExists("local", "$name")).toBe(false);
      fail();
    } catch (e) {
      expect(e).toEqual(new Error("BOOM"));
    }
    listPage.reset();
  });
});
