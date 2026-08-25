import { describe, expect, it } from "vite-plus/test";
import { initials, shortName } from "./person-name.ts";

/**
 * These rules are copied from the production app, so the cases that matter are the ones a German
 * school roster actually produces rather than the ones a name parser is usually tested against.
 */
describe("greeting a self-authored name", () => {
  it("greets by the first name, and by one half of a compound one", () => {
    expect(shortName("Alex Schmidt")).toBe("Alex");
    // What the app does with "Anna-Lena": a greeting is not a form field, and "Moin, Anna!" is
    // what a classmate would say.
    expect(shortName("Anna-Lena Bergmann")).toBe("Anna");
    expect(shortName("Alex")).toBe("Alex");
  });

  it("survives a name nobody would design for", () => {
    expect(shortName("   Alex   Schmidt  ")).toBe("Alex");
    expect(shortName("")).toBe("");
    expect(initials("")).toBe("");
  });

  it("takes initials from the ends of the name, not the middle", () => {
    expect(initials("Alex Schmidt")).toBe("AS");
    expect(initials("Anna Maria Bergmann")).toBe("AB");
    // One word has no last initial to take, so it borrows its own second letter.
    expect(initials("alex")).toBe("AL");
  });
});
