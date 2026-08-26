import { Organization } from "@stu/core";
import { describe, expect, it } from "vite-plus/test";
import { defaultContext, findContext, type ShellContext } from "./contexts.ts";

const school: ShellContext = {
  ref: Organization.schoolContext(Organization.SchoolId.make("igs-lilienthal"), "Student"),
  title: "IGS Lilienthal",
  subtitle: "Schülerzugang",
};
const operator: ShellContext = {
  ref: Organization.operatorContext,
  title: "Studienbuch",
  subtitle: "Plattform-Operator",
};
const contexts = [school, operator];

describe("shell context routing", () => {
  it("selects a remembered context only while the account still owns it", () => {
    expect(defaultContext(contexts, ["operator"])).toBe(operator);
    expect(defaultContext(contexts, ["unknown", "schueler"])).toBe(school);
  });

  it("rejects invalid and unowned explicit context segments", () => {
    expect(findContext(contexts, ["igs-lilienthal", "lehrer"])).toBeUndefined();
    expect(findContext(contexts, ["another-school", "schueler"])).toBeUndefined();
    expect(findContext(contexts, ["igs-lilienthal", "schueler"])).toBe(school);
  });
});
