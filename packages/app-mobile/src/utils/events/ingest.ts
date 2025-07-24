import type { DomainEvent } from "@stu/lib";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { type Effect, Exit } from "effect";
import { clientSyncEngine } from "../groundswell";

export const { SyncEngineProvider, useSyncStatus, useRuntime, useIngest: useSimpleIngest } = clientSyncEngine;
type IngestError = Effect.Effect.Error<Awaited<ReturnType<ReturnType<typeof clientSyncEngine.useIngest>>>>;
export const useIngest = <TEvent extends DomainEvent>(
  type: TEvent["type"],
  options?: Omit<UseMutationOptions<void, IngestError, TEvent["data"], unknown>, "mutationFn">,
) => {
  const ingest = clientSyncEngine.useIngest();

  return useMutation<void, IngestError, TEvent["data"], unknown>({
    ...options,
    mutationFn: async (data) => {
      const result = await ingest({
        type,
        data,
      });
      if (Exit.isFailure(result)) {
        if (result.cause._tag === "Fail") {
          throw result.cause.error;
        }

        if (result.cause._tag === "Die") {
          throw result.cause.defect;
        }
      }
    },
  });
};
