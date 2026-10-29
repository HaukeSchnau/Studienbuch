import { describe, expect, it } from "@effect/vitest";
import { Tokens } from "@stu/ui/Tokens";

import { SubjectColor } from "./SubjectColor.ts";

const subject = (name: string, shortName = "") => SubjectColor.ofSubject({ name, shortName });

describe("SubjectColor", () => {
  it.each([
    ["Mathematik", "Mathe", "MA"],
    ["Politik-Wirtschaft", "Politik / Wirtschaft", "PoWi"],
    ["Französisch", "Franzoesisch", "FR"],
    ["Werte und Normen", "WuN", "WN"],
  ])("gives %s one colour however a school spells it", (name, other, short) => {
    expect(subject(other)).toBe(subject(name));
    expect(subject("", short)).toBe(subject(name));
  });

  it("finds a subject by its short name when the name is unknown", () => {
    expect(subject("Mathematik (erhöhtes Niveau)", "MA")).toBe(subject("Mathematik"));
  });

  it("keeps the core subjects and the sciences apart", () => {
    const slots = [
      "Mathematik",
      "Deutsch",
      "Englisch",
      "Sport",
      "Biologie",
      "Chemie",
      "Physik",
    ].map((name) => subject(name));

    expect(new Set(slots).size).toBe(slots.length);
  });

  it("colours a course without a subject by the letters its name starts with", () => {
    expect(SubjectColor.ofCourse("MA-E1")).toBe(subject("Mathematik"));
    expect(SubjectColor.ofCourse("de-gk2")).toBe(subject("Deutsch"));
    expect(SubjectColor.ofCourse("11bi3")).toBe(subject("Biologie"));
  });

  it.each(["Ethik", "Evangelische Religion", "Katholische Religion", "Religion (kath.)"])(
    "gives %s the values subjects' colour",
    (name) => {
      expect(subject(name)).toBe(subject("Werte und Normen"));
    },
  );

  it.each(["RK", "Sozialwissenschaften", "Gesellschaftslehre", "Technik", "Astronomie"])(
    "keeps the unknown %s off the colours of subjects that have their own",
    (name) => {
      const own = [
        "Mathematik",
        "Deutsch",
        "Englisch",
        "Sport",
        "Biologie",
        "Chemie",
        "Physik",
        "Geschichte",
      ].map((known) => subject(known));

      expect(own).not.toContain(subject(name));
      expect(own).not.toContain(SubjectColor.ofCourse(name));
    },
  );

  it("gives an unknown subject the same palette slot every time", () => {
    const slot = subject("Astronomie");

    expect(Object.keys(Tokens.subject)).toContain(slot);
    expect(subject("astronomie")).toBe(slot);
    expect(SubjectColor.ofCourse("Astronomie")).toBe(slot);
  });
});
