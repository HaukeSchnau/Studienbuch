import * as Schema from "effect/Schema";
import { SchoolAccessKind } from "./access.ts";
import { reservedSchoolId, SchoolId } from "./identity.ts";

/**
 * What a person may do in one context, at the grain navigation needs.
 *
 * Deliberately coarse, and deliberately separate from {@link Capability} in `authority.ts`. That one
 * answers "may this actor acknowledge for *this student* on *this date*" and is the right question
 * for an action. It is the wrong question for a menu: a destination has no target yet, and asking it
 * to invent one in order to decide whether to render a tab produces nonsense.
 *
 * These are the questions a shell asks. Everything finer stays with `authorize`.
 */
export const ContextCapability = Schema.Literals([
  /**
   * See one's own day at this school: what is on, what moved, what was cancelled.
   *
   * Separate from {@link KeepNotebook} because a teacher has a school day and does not have a
   * student's notebook. Folding the two together would have given teachers a grade book they cannot
   * use, and keeping them apart would have left them with no "today" at all — which is the one
   * screen anybody at a school opens every morning.
   */
  "SeeOwnDay",
  /** Keep one's own notebook: timetable, grades, absences, tasks. */
  "KeepNotebook",
  /** Teach: one's own courses, and the confirmations that belong to them. */
  "TeachCourses",
  /** Confirm on behalf of a child in one's care. */
  "AcknowledgeAsGuardian",
  /** Administer one school: its directory, its people, its course offerings. */
  "AdministerSchool",
  /** Operate Studienbuch itself, across every school and none. */
  "OperatePlatform",
]);
export type ContextCapability = typeof ContextCapability.Type;

/**
 * One of the lives a single account leads.
 *
 * An account outlives any school, and one person is routinely several people to Studienbuch: a
 * student at one school, a teacher at another, the operator of the whole thing. A context is which
 * of those they are acting as right now. Exactly one is active, and everything below the shell is
 * scoped to it — which is what stops "whose grades are these" from ever being ambiguous.
 */
export const ContextRef = Schema.TaggedUnion({
  SchoolAccess: { schoolId: SchoolId, kind: SchoolAccessKind },
  Operator: {},
});
export type ContextRef = typeof ContextRef.Type;

export const operatorContext: ContextRef = { _tag: "Operator" };

export const schoolContext = (schoolId: SchoolId, kind: SchoolAccessKind): ContextRef => ({
  _tag: "SchoolAccess",
  schoolId,
  kind,
});

/**
 * What a context entitles someone to.
 *
 * This is the function that grows. Today a school context is described only by a redeemed access
 * code, which names a school and one of two kinds and nothing else. When provider-backed directory
 * memberships arrive, this reads `SchoolMembership.roles` instead and a single context can return
 * several capabilities — a teacher who is also a class teacher, an administrator who also teaches.
 *
 * Nothing else has to change when that happens. The registry, the navigation and every route ask
 * only what this returns, which is the entire point of naming the question this way.
 */
export const capabilitiesFor = (ref: ContextRef): ReadonlyArray<ContextCapability> => {
  switch (ref._tag) {
    case "Operator":
      return ["OperatePlatform"];
    case "SchoolAccess":
      return ref.kind === "Student" ? ["SeeOwnDay", "KeepNotebook"] : ["SeeOwnDay", "TeachCourses"];
  }
};

export const hasCapability = (ref: ContextRef, capability: ContextCapability) =>
  capabilitiesFor(ref).includes(capability);

/**
 * The path segment naming the operator context.
 *
 * The same word `SchoolId` refuses, so that no school can ever be spelled the way the operator is.
 */
export const operatorSegment = reservedSchoolId;

/**
 * German for the two access kinds, because these appear in the address bar.
 *
 * Here rather than in a route file so that a link built by the web and a link opened by the phone
 * agree. A deep link is a contract between surfaces, not a detail of one of them.
 */
const kindSegments = {
  Student: "schueler",
  Teacher: "lehrer",
} as const satisfies Record<SchoolAccessKind, string>;

const kindBySegment = new Map<string, SchoolAccessKind>([
  [kindSegments.Student, "Student"],
  [kindSegments.Teacher, "Teacher"],
]);

const isSchoolId = Schema.is(SchoolId);

/** The path segments identifying a context, without a leading or trailing separator. */
export const contextSegments = (ref: ContextRef): ReadonlyArray<string> =>
  ref._tag === "Operator" ? [operatorSegment] : [ref.schoolId, kindSegments[ref.kind]];

export const contextPath = (ref: ContextRef) => `/app/${contextSegments(ref).join("/")}`;

/**
 * Reads a context back out of its path segments, or `undefined` if they do not name one.
 *
 * Total rather than throwing: these segments come from the address bar, so a person can type
 * anything into them, and "that is not a context" is an ordinary answer rather than a fault.
 */
export const parseContextSegments = (segments: ReadonlyArray<string>): ContextRef | undefined => {
  const [first, second] = segments;
  if (first === operatorSegment && second === undefined) return operatorContext;
  if (first === undefined || second === undefined) return undefined;
  const kind = kindBySegment.get(second);
  if (kind === undefined || !isSchoolId(first)) return undefined;
  return schoolContext(first, kind);
};

/** Whether two contexts are the same one. */
export const sameContext = (left: ContextRef, right: ContextRef) =>
  left._tag === "Operator"
    ? right._tag === "Operator"
    : right._tag === "SchoolAccess" && left.schoolId === right.schoolId && left.kind === right.kind;
