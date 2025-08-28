import { FetchHttpClient } from "@effect/platform";
import { describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { UntisAuth } from "./login";

describe("Kadmos Login", () => {
  it.effect("should login", () =>
    UntisAuth.login({
      kadmosName: "IGS Lilienthal",
      kadmosUsername: "hauke.studienbuch",
      kadmosPassword: "App#Hauke2024",
    }).pipe(Effect.provide(FetchHttpClient.layer)),
  );
});
