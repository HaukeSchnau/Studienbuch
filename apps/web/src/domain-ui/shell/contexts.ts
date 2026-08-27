import { Organization } from "@stu/core/organization";
import type { AccountView, SchoolAccessView } from "#/features/auth/access.ts";

/**
 * A context as the shell needs to show it: what it is, and what to call it.
 *
 * `Organization.ContextRef` is the identity and belongs to the domain. The words belong here,
 * because they are what a person reads in a switcher and nothing in the domain should be choosing
 * German for a menu.
 */
export interface ShellContext {
  readonly ref: Organization.ContextRef;
  readonly title: string;
  readonly subtitle: string;
  /** Present for a school context, so a destination can reach the profile without another lookup. */
  readonly access?: SchoolAccessView;
}

const kindLabel = (kind: Organization.SchoolAccessKind) =>
  kind === "Student" ? "Schülerzugang" : "Lehrerzugang";

/**
 * Every context an account can act in.
 *
 * Sorted by school and then kind rather than left in whatever order the database returned, so the
 * switcher does not reorder itself between visits. The operator context is last because it is the
 * rarest and the least like the others: it belongs to no school at all.
 */
export const contextsFor = (account: AccountView): ReadonlyArray<ShellContext> => {
  const schools = [...account.accesses]
    .sort(
      (left, right) =>
        left.schoolName.localeCompare(right.schoolName, "de-DE") ||
        left.kind.localeCompare(right.kind),
    )
    .map((access): ShellContext => ({
      ref: Organization.schoolContext(access.schoolId, access.kind),
      title: access.schoolName,
      subtitle: kindLabel(access.kind),
      access,
    }));

  return account.operator
    ? [
        ...schools,
        {
          ref: Organization.operatorContext,
          title: "Studienbuch",
          subtitle: "Plattform-Operator",
        },
      ]
    : schools;
};

/** The context these path segments name, if the account actually holds it. */
export const findContext = (
  contexts: ReadonlyArray<ShellContext>,
  segments: ReadonlyArray<string>,
) => {
  const ref = Organization.parseContextSegments(segments);
  return ref === undefined
    ? undefined
    : contexts.find((context) => Organization.sameContext(context.ref, ref));
};

/** The context named by the prefix of an application route, before its destination segments. */
export const findRouteContext = (
  contexts: ReadonlyArray<ShellContext>,
  segments: ReadonlyArray<string>,
) => findContext(contexts, segments.slice(0, segments[0] === Organization.operatorSegment ? 1 : 2));

/** Chooses the remembered context when it is still valid, then the stable first context. */
export const defaultContext = (
  contexts: ReadonlyArray<ShellContext>,
  rememberedSegments: ReadonlyArray<string>,
) => findContext(contexts, rememberedSegments) ?? contexts.at(0);
