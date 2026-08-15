import { entityId } from "../internal/entity-id";

/** Identifies one configured provider feed. */
export const DataSourceId = entityId("DataSourceId");
export type DataSourceId = typeof DataSourceId.Type;

/** Identifies one import run, independent of the records observed during that run. */
export const ImportId = entityId("ImportId");
export type ImportId = typeof ImportId.Type;

/** Identifies a provider-owned record within one data source. */
export const ExternalId = entityId("ExternalId");
export type ExternalId = typeof ExternalId.Type;
