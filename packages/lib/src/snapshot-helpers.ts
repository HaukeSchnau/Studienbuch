import type { SnapshotEntityKind, SnapshotEntityRef } from "./snapshot";

export const uniqueBy = <T, K extends PropertyKey>(items: readonly T[], key: (item: T) => K): T[] => {
  const deduped = new Map<K, T>();
  for (const item of items) {
    deduped.set(key(item), item);
  }
  return [...deduped.values()];
};

export const entityRefsByKind = (entities: readonly SnapshotEntityRef[], kind: SnapshotEntityKind): string[] =>
  uniqueBy(
    entities.filter((entity) => entity.kind === kind),
    (entity) => entity.id,
  ).map((entity) => entity.id);
