import { describe, expect, it } from "vite-plus/test";
import {
  capabilitiesFor,
  contextPath,
  hasCapability,
  operatorContext,
  operatorSegment,
  parseContextSegments,
  sameContext,
  schoolContext,
} from "./context.ts";
import { SchoolId } from "./identity.ts";

const igs = SchoolId.make("igs-lilienthal");
const student = schoolContext(igs, "Student");
const teacher = schoolContext(igs, "Teacher");

describe("what a context entitles someone to", () => {
  it("gives a student their notebook and a teacher their courses", () => {
    expect(capabilitiesFor(student)).toEqual(["SeeOwnDay", "KeepNotebook"]);
    expect(capabilitiesFor(teacher)).toEqual(["SeeOwnDay", "TeachCourses"]);
    expect(capabilitiesFor(operatorContext)).toEqual(["OperatePlatform"]);
  });

  it("gives everybody at a school their own day, and the operator nobody's", () => {
    // A teacher's morning is a school day like anyone else's. Only the notebook is a student's.
    expect(hasCapability(teacher, "SeeOwnDay")).toBe(true);
    expect(hasCapability(teacher, "KeepNotebook")).toBe(false);
    expect(hasCapability(operatorContext, "SeeOwnDay")).toBe(false);
  });

  it("keeps a school context away from platform operation, and the reverse", () => {
    // The separation the whole design rests on: an access code is redeemed at one school and can
    // never widen into authority over Studienbuch itself.
    expect(hasCapability(teacher, "OperatePlatform")).toBe(false);
    expect(hasCapability(operatorContext, "KeepNotebook")).toBe(false);
  });
});

describe("spelling a context as a path", () => {
  it("round-trips a school context through its segments", () => {
    expect(contextPath(student)).toBe("/app/igs-lilienthal/schueler");
    expect(contextPath(teacher)).toBe("/app/igs-lilienthal/lehrer");
    expect(parseContextSegments(["igs-lilienthal", "schueler"])).toEqual(student);
    expect(parseContextSegments(["igs-lilienthal", "lehrer"])).toEqual(teacher);
  });

  it("round-trips the operator context", () => {
    expect(contextPath(operatorContext)).toBe(`/app/${operatorSegment}`);
    expect(parseContextSegments([operatorSegment])).toEqual(operatorContext);
  });

  it("keeps the two kinds at one school apart", () => {
    // An account may hold both at the same school, so the kind segment is what distinguishes them.
    expect(sameContext(student, teacher)).toBe(false);
    expect(sameContext(student, schoolContext(igs, "Student"))).toBe(true);
  });

  it("answers 'not a context' for anything typed into the address bar", () => {
    expect(parseContextSegments([])).toBeUndefined();
    expect(parseContextSegments(["igs-lilienthal"])).toBeUndefined();
    expect(parseContextSegments(["igs-lilienthal", "hausmeister"])).toBeUndefined();
    // The reserved segment names the operator context alone, never a school called `operator`.
    expect(parseContextSegments([operatorSegment, "schueler"])).toBeUndefined();
    // A school id has to be a slug, because it is also a path segment.
    expect(parseContextSegments(["IGS Lilienthal", "schueler"])).toBeUndefined();
  });
});
