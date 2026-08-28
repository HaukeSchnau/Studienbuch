import { AccessApi } from "@stu/api";
import { Organization } from "@stu/core";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { isActive } from "./operator.ts";
import {
  completeReservation,
  inspectReservation,
  listForUser,
  reserve,
  saveProfile,
} from "./school-access.ts";

const school = (value: { readonly id: string; readonly name: string }) => ({
  id: Organization.SchoolId.make(value.id),
  name: value.name,
});

export const AccessRpcHandlers = AccessApi.Rpcs.toLayer({
  "Access.Reserve": ({ code }) =>
    reserve(code).pipe(
      Effect.map((reservation) => ({
        token: Organization.SchoolAccessReservationToken.make(reservation.token),
        expiresAt: DateTime.fromDateUnsafe(reservation.expiresAt),
        school: school(reservation.school),
        kind: reservation.kind,
      })),
      Effect.catchTags({
        EffectDrizzleQueryError: (error) => Effect.die(error),
        SqlError: (error) => Effect.die(error),
      }),
    ),
  "Access.InspectReservation": ({ token }) =>
    inspectReservation(token).pipe(
      Effect.map((reservation) => ({
        expiresAt: DateTime.fromDateUnsafe(reservation.expiresAt),
        school: school(reservation.school),
        kind: reservation.kind,
      })),
      Effect.catchTag("EffectDrizzleQueryError", (error) => Effect.die(error)),
    ),
  "Access.CompleteReservation": ({ token }) =>
    Effect.gen(function* () {
      const user = yield* AccessApi.AuthenticatedUser;
      const access = yield* completeReservation(user.id, token);
      return {
        id: Organization.SchoolAccessId.make(access.id),
        createdAt: DateTime.fromDateUnsafe(access.createdAt),
        school: school(access.school),
        kind: access.kind,
      };
    }).pipe(
      Effect.catchTags({
        EffectDrizzleQueryError: (error) => Effect.die(error),
        SqlError: (error) => Effect.die(error),
      }),
    ),
  "Access.SaveProfile": (input) =>
    Effect.gen(function* () {
      const user = yield* AccessApi.AuthenticatedUser;
      const profile = yield* saveProfile(user.id, input);
      return {
        profile: {
          cohort:
            profile.cohort === undefined
              ? null
              : Organization.OptionalProfileField.make(profile.cohort),
          className:
            profile.className === undefined
              ? null
              : Organization.OptionalProfileField.make(profile.className),
        },
      };
    }).pipe(Effect.catchTag("EffectDrizzleQueryError", (error) => Effect.die(error))),
  "Access.GetAccount": () =>
    Effect.gen(function* () {
      const user = yield* AccessApi.AuthenticatedUser;
      const { accesses, operator } = yield* Effect.all({
        accesses: listForUser(user.id),
        operator: isActive(user.id),
      });
      return {
        user: {
          ...user,
          name: Organization.AccountName.make(user.name),
        },
        operator,
        accesses: accesses.map((access) => ({
          id: Organization.SchoolAccessId.make(access.id),
          kind: access.kind,
          createdAt: DateTime.fromDateUnsafe(access.createdAt),
          schoolId: Organization.SchoolId.make(access.schoolId),
          schoolName: access.schoolName,
          profile:
            access.profileId === null
              ? null
              : {
                  cohort: access.cohort,
                  className: access.className,
                },
        })),
      };
    }).pipe(Effect.catchTag("EffectDrizzleQueryError", (error) => Effect.die(error))),
});
