import type { ApplicatorError, StorageError, ValidationError } from "@groundswell/core";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { Cause, Exit, Option } from "effect";
import type { DomainEvent } from "../../../../student/src/domain-event";
import { clientSyncEngine } from "../groundswell";

export const { SyncEngineProvider, useSyncStatus, useRuntime, useIngest: useSimpleIngest } = clientSyncEngine;

type IngestError = ValidationError | ApplicatorError | StorageError;
type EventForType<TType extends DomainEvent["type"]> = Extract<DomainEvent, { type: TType }>;

export const useIngest = <TType extends DomainEvent["type"]>(
  type: TType,
  options?: Omit<UseMutationOptions<void, IngestError, EventForType<TType>["data"], unknown>, "mutationFn">,
) => {
  const ingest = clientSyncEngine.useIngest();

  return useMutation<void, IngestError, EventForType<TType>["data"], unknown>({
    ...options,
    mutationFn: async (data) => {
      const result = await ingest({
        type,
        data,
      });

      if (Exit.isFailure(result)) {
        const failure = Exit.findErrorOption(result);
        if (Option.isSome(failure)) {
          throw failure.value;
        }

        throw Cause.squash(result.cause);
      }
    },
  });
};
