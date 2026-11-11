import { describe, expect, it } from "@effect/vitest";
import { Tokens } from "@stu/ui/Tokens";

import { SubjectLook } from "./SubjectLook.ts";

const subject = (name: string, shortName = "") => SubjectLook.ofSubject({ name, shortName }).slot;

describe("SubjectLook", () => {
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
    expect(SubjectLook.ofCourse("MA-E1").slot).toBe(subject("Mathematik"));
    expect(SubjectLook.ofCourse("de-gk2").slot).toBe(subject("Deutsch"));
    expect(SubjectLook.ofCourse("11bi3").slot).toBe(subject("Biologie"));
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
      expect(own).not.toContain(SubjectLook.ofCourse(name).slot);
    },
  );

  it("gives an unknown subject the same palette slot every time", () => {
    const slot = subject("Astronomie");

    expect(Object.keys(Tokens.subject)).toContain(slot);
    expect(subject("astronomie")).toBe(slot);
    expect(SubjectLook.ofCourse("Astronomie").slot).toBe(slot);
  });

  it("draws a known subject and spells an unknown one", () => {
    expect(SubjectLook.ofSubject({ name: "Mathe", shortName: "M" })).toMatchObject({
      art: "ma",
      letters: "M",
    });
    expect(SubjectLook.ofSubject({ name: "Astronomie", shortName: "" })).toMatchObject({
      art: undefined,
      letters: "Ast",
    });
    expect(SubjectLook.ofCourse("PW-G2")).toMatchObject({ art: undefined, letters: "PW" });
  });
});
