import { describe, expect, it } from "vitest";

import { login } from "./login";

describe("Kadmos Login", () => {
  it("should login", async () => {
    await login("IGS Lilienthal", "hauke.studienbuch", "App#Hauke2024");
  });
});
