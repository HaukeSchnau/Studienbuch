import { AccessApi } from "@stu/api";
import { describe, expect, it } from "vite-plus/test";
import { AsyncResult, AtomRegistry } from "effect/unstable/reactivity";
import { accountAtom } from "./access.ts";
import { requireAccount } from "./account-loader.ts";

const registryWithFailure = (failure: AccessApi.AuthenticationRequired | AccessApi.RateLimited) =>
  AtomRegistry.make({ initialValues: [[accountAtom, AsyncResult.fail(failure)]] });

describe("account route guard", () => {
  it("redirects an unauthenticated account read to sign-in", async () => {
    const atomRegistry = registryWithFailure(AccessApi.AuthenticationRequired.make({}));

    await expect(
      requireAccount({ atomRegistry }, new AbortController().signal),
    ).rejects.toMatchObject({ options: { to: "/anmelden", replace: true } });
    atomRegistry.dispose();
  });

  it("leaves non-authentication failures for the route error boundary", async () => {
    const failure = AccessApi.RateLimited.make({ retryAfterSeconds: 30 });
    const atomRegistry = registryWithFailure(failure);

    await expect(requireAccount({ atomRegistry }, new AbortController().signal)).rejects.toBe(
      failure,
    );
    atomRegistry.dispose();
  });
});
