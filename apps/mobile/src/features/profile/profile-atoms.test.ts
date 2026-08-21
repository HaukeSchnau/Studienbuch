import { AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it } from "vite-plus/test";
import { profileAtom, updateProfileAtom } from "./profile-atoms";

const profile = {
  name: "Hauke",
  isOfAge: false,
  yearId: "y12",
  classId: "c12a",
  schoolName: "IGS Lilienthal",
  licenseKey: "STUB-U123-2026-UI00",
};

describe("profile atoms", () => {
  it("applies a partial update without losing unchanged profile fields", () => {
    const registry = AtomRegistry.make({ initialValues: [[profileAtom, profile]] });

    registry.set(updateProfileAtom, { name: "Hauke Schnau", isOfAge: true });

    expect(registry.get(profileAtom)).toEqual({
      ...profile,
      name: "Hauke Schnau",
      isOfAge: true,
    });
    registry.dispose();
  });
});
