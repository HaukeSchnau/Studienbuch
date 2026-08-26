import { Organization } from "@stu/core/organization";
import {
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  House,
  KeyRound,
  School,
  UserRound,
} from "lucide-react";
import type { ComponentType } from "react";

/**
 * The routes a destination can occupy.
 *
 * Written out rather than assembled from a segment, because `Link` resolves `to` against the
 * generated route tree: a template literal would type-check as `string` and give up exactly the
 * guarantee that makes a mistyped destination a compile error rather than a dead tab.
 */
export type DestinationPath =
  | "/app/konto"
  | "/app/operator/schulen"
  | "/app/operator/zugangscodes"
  | "/app/$school/$rolle/heute"
  | "/app/$school/$rolle/woche"
  | "/app/$school/$rolle/kurse"
  | "/app/$school/$rolle/bestaetigungen";

/**
 * A place in the application, and what a person must be able to do for it to exist for them.
 *
 * Destinations name a capability, never a role. That is the whole discipline: when provider-backed
 * directory memberships arrive and one context starts returning several capabilities, this table is
 * already correct — only `Organization.capabilitiesFor` changes. A table keyed on "teacher" would
 * have to be revisited for every role the school system turns out to have.
 */
interface Common {
  readonly id: string;
  readonly label: string;
  readonly icon: ComponentType<{ readonly className?: string }>;
}

/**
 * `placement` is which route family the destination belongs to, and it exists so that `to` narrows.
 * A school route takes `$school` and `$rolle`; an operator or account route takes no parameters at
 * all. Without the discriminant every link would need a cast to satisfy the router.
 */
export type Destination =
  | (Common & {
      readonly placement: "school";
      readonly capability: Organization.ContextCapability;
      readonly to: Extract<DestinationPath, `/app/$school/${string}`>;
    })
  | (Common & {
      readonly placement: "operator";
      readonly capability: Organization.ContextCapability;
      readonly to: Extract<DestinationPath, `/app/operator/${string}`>;
    })
  | (Common & {
      readonly placement: "account";
      readonly capability?: undefined;
      readonly to: "/app/konto";
    });

/**
 * Every destination the web application knows.
 *
 * Operator entries are registered here and nowhere else. The mobile app builds its own list from the
 * same capability model and simply never names these — which is how administration stays out of a
 * student's bundle while remaining an ordinary context rather than a separate application.
 */
export const destinations: ReadonlyArray<Destination> = [
  {
    id: "overview",
    label: "Übersicht",
    icon: House,
    placement: "school",
    capability: "KeepNotebook",
    to: "/app/$school/$rolle/heute",
  },
  {
    id: "week",
    label: "Meine Woche",
    icon: CalendarDays,
    placement: "school",
    capability: "KeepNotebook",
    to: "/app/$school/$rolle/woche",
  },
  {
    id: "courses",
    label: "Meine Kurse",
    icon: GraduationCap,
    placement: "school",
    capability: "TeachCourses",
    to: "/app/$school/$rolle/kurse",
  },
  {
    id: "confirmations",
    label: "Bestätigungen",
    icon: ClipboardCheck,
    placement: "school",
    capability: "TeachCourses",
    to: "/app/$school/$rolle/bestaetigungen",
  },
  {
    id: "schools",
    label: "Schulen",
    icon: School,
    placement: "operator",
    capability: "OperatePlatform",
    to: "/app/operator/schulen",
  },
  {
    id: "codes",
    label: "Zugangscodes",
    icon: KeyRound,
    placement: "operator",
    capability: "OperatePlatform",
    to: "/app/operator/zugangscodes",
  },
  { id: "account", label: "Mein Konto", icon: UserRound, placement: "account", to: "/app/konto" },
];

/**
 * The destinations a context offers, in registry order, with the account always last.
 *
 * The account entry is appended rather than filtered in, because it belongs to the person and is
 * reachable from wherever they happen to be standing. That is also why "Mein Konto" keeps its place
 * at the end of the bar in every context, exactly as the legacy app kept "Mein Profil" there.
 */
export const destinationsFor = (context: Organization.ContextRef) =>
  destinations.filter(
    (destination) =>
      destination.capability === undefined ||
      Organization.hasCapability(context, destination.capability),
  );

/** The destination a context opens on: its first, which its capabilities decide. */
export const landingDestination = (context: Organization.ContextRef) => destinationsFor(context)[0];

/**
 * The route parameters a school context supplies.
 *
 * `undefined` for the operator context, whose path carries no parameters at all — which is also how
 * a caller can tell the two route shapes apart without re-deriving the context's tag.
 */
export const contextParams = (context: Organization.ContextRef) => {
  if (context._tag === "Operator") return undefined;
  const [school, rolle] = Organization.contextSegments(context);
  return school === undefined || rolle === undefined ? undefined : { school, rolle };
};
