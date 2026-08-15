import { assert, describe, expect, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Importing from "./index.ts";
import {
  DataSourceId,
  ExternalId,
  ImportId,
  NonEmptyText,
  PersonId,
  Revision,
  SchoolId,
  SchoolMembershipId,
  SubjectId,
} from "../foundation/index.ts";
import { Subject, SubjectCatalog } from "../organization/catalog.ts";

const source = Importing.DataSource.make({
  id: DataSourceId.make("untis-school-1"),
  provider: NonEmptyText.make("Untis"),
});

const stamp = (revision: number, dataSource = source) =>
  Importing.SourceStamp.make({
    dataSource,
    externalId: ExternalId.make("course-42"),
    importId: ImportId.make(`import-${revision}`),
    revision: Revision.make(revision),
    observedAt: DateTime.makeUnsafe(`2026-08-${String(revision + 1).padStart(2, "0")}T08:00:00Z`),
  });

const observation = (value: string, revision: number, rawValue: Schema.Json = value) => ({
  value,
  rawValue,
  stamp: stamp(revision),
});

const actor = {
  personId: PersonId.make("person-1"),
  schoolMembershipId: SchoolMembershipId.make("membership-1"),
};

describe("import reconciliation", () => {
  it("retains provider-scoped identity and deterministically ignores duplicates and stale values", () => {
    const current = Importing.sourcedValue(
      observation("Mathematics", 2, { code: "MA", name: "Math" }),
    );
    const duplicate = Importing.reconcileIncoming(
      current,
      observation("Mathematics", 2, { name: "Math", code: "MA" }),
    );
    expect(duplicate._tag).toBe("Duplicate");

    const stale = Importing.reconcileIncoming(current, observation("Old mathematics", 1));
    expect(stale._tag).toBe("Stale");
    expect(stale.value).toBe(current);

    const otherProvider = Importing.DataSource.make({
      id: source.id,
      provider: NonEmptyText.make("Another provider"),
    });
    const renamedProvider = Importing.reconcileIncoming(current, {
      ...observation("Mathematics", 3),
      stamp: stamp(3, otherProvider),
    });
    expect(renamedProvider).toMatchObject({ _tag: "Updated" });
  });

  it.effect("preserves and relinquishes a field-level user override", () =>
    Effect.gen(function* () {
      const current = Importing.applyOverride(Importing.sourcedValue(observation("Room 1", 1)), {
        value: "My room",
        changedBy: actor,
        changedAt: DateTime.makeUnsafe("2026-08-10T12:00:00Z"),
      });
      const result = Importing.reconcileIncoming(current, observation("Room 2", 2));
      assert.strictEqual(result._tag, "Updated");
      if (result._tag !== "Updated") return;
      assert.strictEqual(result.overridePreserved, true);
      assert.strictEqual(result.effectiveValueChanged, false);
      assert.strictEqual(result.value._tag, "Overridden");
      if (result.value._tag !== "Overridden") return;
      assert.strictEqual(result.value.override.value, "My room");

      const relinquished = yield* Importing.relinquishOverride(result.value);
      assert.strictEqual(relinquished._tag, "Sourced");
      if (relinquished._tag !== "Sourced") return;
      assert.strictEqual(relinquished.source.value, "Room 2");
    }),
  );

  it("distinguishes raw-source churn from an effective value change", () => {
    const current = Importing.sourcedValue(observation("Mathematics", 1, { label: "Math" }));
    const result = Importing.reconcileIncoming(
      current,
      observation("Mathematics", 2, { label: "Mathematics" }),
    );
    expect(result).toMatchObject({ _tag: "Updated", effectiveValueChanged: false });
  });

  it.effect("distinguishes partial feeds from complete-feed deletion", () =>
    Effect.gen(function* () {
      const current = Importing.applyOverride(Importing.sourcedValue(observation("Imported", 1)), {
        value: "Manual",
        changedBy: actor,
        changedAt: DateTime.makeUnsafe("2026-08-10T12:00:00Z"),
      });
      const deletion = { ...stamp(2), completeness: "Partial" as const };
      const partial = Importing.reconcileSourceDeletion(current, deletion);
      assert.deepEqual(partial, { _tag: "Retained", value: current, reason: "PartialFeed" });

      const complete = Importing.reconcileSourceDeletion(current, {
        ...deletion,
        completeness: "Complete",
      });
      assert.strictEqual(complete._tag, "OverrideDetached");
      if (complete._tag !== "OverrideDetached") return;
      assert.deepEqual(complete.value, { _tag: "Overridden", override: current.override });

      const refusal = yield* Effect.flip(Importing.relinquishOverride(complete.value));
      assert.strictEqual(refusal._tag, "Importing.OverrideRelinquishmentRefused");
      assert.strictEqual(refusal.reason, "SourceNoLongerAvailable");
    }),
  );
});

describe("subject resolution", () => {
  const schoolId = SchoolId.make("school-1");
  const subject = (id: string, name: string, code: string, aliases: ReadonlyArray<string>) =>
    Subject.make({
      id: SubjectId.make(id),
      schoolId,
      name: NonEmptyText.make(name),
      code: NonEmptyText.make(code),
      aliases: aliases.map((alias) => NonEmptyText.make(alias)),
      externalRefs: [],
    });

  const catalog = SubjectCatalog.make({
    schoolId,
    subjects: [
      subject("informatics", "Informatik", "IF", ["Computer Science"]),
      subject("social-science-a", "Politik", "PW", ["PoWi"]),
      subject("social-science-b", "Politikwissenschaft", "POL", ["PoWi"]),
    ],
  });

  it("keeps raw labels across exact, inferred, ambiguous, and unknown outcomes", () => {
    expect(Importing.resolveSubject("  Informatik  ", catalog)).toEqual({
      _tag: "Exact",
      subjectId: SubjectId.make("informatics"),
      rawLabel: "  Informatik  ",
    });
    expect(Importing.resolveSubject("IF23", catalog)).toEqual({
      _tag: "Inferred",
      subjectId: SubjectId.make("informatics"),
      rawLabel: "IF23",
      rule: "CourseCodePrefix",
    });
    expect(Importing.resolveSubject("PoWi", catalog)).toMatchObject({
      _tag: "Ambiguous",
      rawLabel: "PoWi",
      candidateSubjectIds: [SubjectId.make("social-science-a"), SubjectId.make("social-science-b")],
    });
    expect(Importing.resolveSubject("Mystery Lab", catalog)).toEqual({
      _tag: "Unknown",
      rawLabel: "Mystery Lab",
    });
  });
});
