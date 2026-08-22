import { AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it } from "vite-plus/test";
import {
  absenceIdFactoryAtom,
  absencesAtom,
  absenceSignatureFactoryAtom,
  addAbsenceAtom,
  deleteAbsenceAtom,
  signAbsenceAtom,
  type AbsenceSigner,
} from "./absence-atoms";

describe("absence atoms", () => {
  it("adds, signs, and deletes absences through injected implementations", () => {
    const registry = AtomRegistry.make({
      initialValues: [
        [absencesAtom, []],
        [absenceIdFactoryAtom, { create: () => "absence-created" }],
        [absenceSignatureFactoryAtom, { create: (signer: AbsenceSigner) => `signature:${signer}` }],
      ],
    });

    registry.set(addAbsenceAtom, {
      date: new Date("2026-08-24T08:00:00.000Z"),
      courseIds: ["course-math"],
      reason: "Appointment",
    });
    registry.set(signAbsenceAtom, { absenceId: "absence-created", signer: "parent" });
    registry.set(signAbsenceAtom, { absenceId: "absence-created", signer: "teacher" });

    expect(registry.get(absencesAtom)).toEqual([
      {
        id: "absence-created",
        date: new Date("2026-08-24T08:00:00.000Z"),
        courseIds: ["course-math"],
        reason: "Appointment",
        parentSignature: "signature:parent",
        teacherSignature: "signature:teacher",
      },
    ]);

    registry.set(deleteAbsenceAtom, "absence-created");
    expect(registry.get(absencesAtom)).toEqual([]);
    registry.dispose();
  });
});
