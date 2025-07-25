import type { NamespaceServerApplicatorMap } from "@groundswell/core";
import { ValidationError } from "@groundswell/core";
import { AuthRepository, type DomainEvent, type UnknownDatabaseError } from "@stu/lib";
import { Effect } from "effect";
import { Database } from "../database";

const SYSTEM_USER = "00000000-0000-0000-0000-000000000000";

export const authApplicators: NamespaceServerApplicatorMap<
  DomainEvent,
  "auth",
  UnknownDatabaseError,
  Database | AuthRepository
> = {
  licenseGenerated: {
    verify: Effect.fn(function* (event, { initiatorId }) {
      if (initiatorId !== SYSTEM_USER) {
        return yield* Effect.fail(new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }));
      }

      const repo = yield* AuthRepository;
      if (yield* repo.doesLicenseKeyExist({ key: event.data.licenseKey })) {
        return yield* Effect.fail(new ValidationError({ cause: "EXISTS", reason: "DUPLICATE" }));
      }
    }),
    apply: (event) =>
      Effect.andThen(AuthRepository, (repo) =>
        repo.createLicenseKey({
          key: event.data.licenseKey,
          school: event.data.school,
          expiresAt: event.data.expiryDate,
          isSuperKey: event.data.licenseKey === "KJ27-MP16-LS14-JM22",
        }),
      ),
    getEventTopics: () => Effect.succeed([]),
  },

  licenseActivated: {
    verify: Effect.fn(function* (event, { initiatorId }) {
      if (initiatorId !== SYSTEM_USER && initiatorId !== event.data.userId) {
        return yield* Effect.fail(new ValidationError({ cause: "UNEXPECTED", reason: "NOT_ALLOWED" }));
      }

      const repo = yield* AuthRepository;
      const key = yield* repo.getLicenseKey({ key: event.data.licenseKey });

      if (key === undefined) {
        return yield* Effect.fail(new ValidationError({ cause: "INVALID_LICENSE_KEY", reason: "INVALID" }));
      }

      if (key.isSuperKey) {
        return yield* Effect.succeed(void 0);
      }

      if (key.expiresAt && key.expiresAt < new Date()) {
        return yield* Effect.fail(new ValidationError({ cause: "EXPIRED", reason: "INVALID" }));
      }

      if (key.activatedBy) {
        return yield* Effect.fail(new ValidationError({ cause: "ALREADY_ACTIVATED", reason: "INVALID" }));
      }
    }),
    apply: Effect.fn(function* (event) {
      const repo = yield* AuthRepository;
      yield* repo.createUser({ userId: event.data.userId });
      yield* repo.activateLicenseKey({ key: event.data.licenseKey, userId: event.data.userId });
    }, Database.asTransaction),
    getEventTopics: () => Effect.succeed([]),
  },
};
