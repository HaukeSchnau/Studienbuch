import type { DomainEvent } from "@stu/lib";
import { AuthRepository } from "./auth.repo";

import type { NamespaceServerApplicatorMap } from "@groundswell/core";
import { ValidationError } from "@groundswell/core";
import { Database } from "../database";
import type { DatabaseError } from "@schnau/effect-drizzle/postgres";
import { Effect } from "effect";

const SYSTEM_USER = "00000000-0000-0000-0000-000000000000";

export const authApplicators: NamespaceServerApplicatorMap<
  DomainEvent,
  "auth",
  DatabaseError,
  Database | AuthRepository
> = {
  licenseGenerated: {
    verify: Effect.fn(function* (event, { initiatorId }) {
      if (initiatorId !== SYSTEM_USER) {
        return yield* Effect.fail(new ValidationError({ cause: "NOT_ALLOWED" }));
      }

      const repo = yield* AuthRepository;
      if (yield* repo.doesLicenseKeyExist({ key: event.data.licenseKey })) {
        return yield* Effect.fail(new ValidationError({ cause: "EXISTS" }));
      }
    }),
    apply: (event) =>
      AuthRepository.use((repo) =>
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
        return yield* Effect.fail(new ValidationError({ cause: "UNEXPECTED" }));
      }

      const repo = yield* AuthRepository;
      const key = yield* repo.getLicenseKey({ key: event.data.licenseKey });

      if (key === undefined) {
        return yield* Effect.fail(new ValidationError({ cause: "INVALID_LICENSE_KEY" }));
      }

      if (key.isSuperKey) {
        return yield* Effect.succeed(void 0);
      }

      if (key.expiresAt && key.expiresAt < new Date()) {
        return yield* Effect.fail(new ValidationError({ cause: "EXPIRED" }));
      }

      if (key.activatedBy) {
        return yield* Effect.fail(new ValidationError({ cause: "ALREADY_ACTIVATED" }));
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
