import * as Schema from "effect/Schema";
import { ArtifactId, ExternalId, TrimmedNonEmptyString } from "./ids";

export const NonEmptyText = TrimmedNonEmptyString.pipe(Schema.brand("NonEmptyText"));
export type NonEmptyText = typeof NonEmptyText.Type;

export const Revision = Schema.Natural.pipe(Schema.brand("Revision"));
export type Revision = typeof Revision.Type;

export const ArtifactRef = Schema.Struct({
  id: ArtifactId,
  mediaType: TrimmedNonEmptyString,
  digest: Schema.optionalKey(TrimmedNonEmptyString),
});
export interface ArtifactRef extends Schema.Schema.Type<typeof ArtifactRef> {}

export const ExternalRef = Schema.Struct({
  provider: TrimmedNonEmptyString,
  externalId: ExternalId,
});
export interface ExternalRef extends Schema.Schema.Type<typeof ExternalRef> {}
