import type { ExternalEntityKind } from "@stu/core/importing";
import type * as Schema from "effect/Schema";
import { sha256Text } from "../cryptography/content-hash.ts";

export interface SourceRecordObservation {
  readonly _tag: ExternalEntityKind;
  readonly externalId: string;
  readonly payload: Schema.Json;
}

export interface SourceSnapshot<Observation extends SourceRecordObservation> {
  readonly provider: string;
  readonly dataSourceId: string;
  readonly dataset: string;
  readonly scope: string;
  readonly contentHash: string;
  readonly completeness: "Complete" | "Partial";
  readonly observations: ReadonlyArray<Observation>;
  readonly counts: Schema.Json;
  readonly diagnostics: Schema.Json;
}

export const hashSourceObservations = (observations: ReadonlyArray<SourceRecordObservation>) =>
  sha256Text(JSON.stringify(observations));

export const hashSourceObservation = (observation: SourceRecordObservation) =>
  hashSourceObservations([observation]);
