# Model civil time explicitly

- Status: accepted
- Date: 2026-08-15

Core represents calendar dates directly as timezone-free Temporal `PlainDate.Record` values while `PlainDateSchema` encodes them as ISO 8601 strings at persistence and transport boundaries. Schedule represents `LocalTime` as integer milliseconds since midnight while encoding it as that number. Calendar-date ranges are closed and local-time ranges are half-open; absolute audit timestamps continue to use Effect `DateTime.Utc`, zoned instants use `DateTime.Zoned`, and elapsed time uses Effect `Duration`. This prevents JavaScript `Date`, time zones, and string ordering from silently changing school-day rules while preserving compact, stable wire formats.

We use the tree-shakeable `temporal-polyfill` functional API because Temporal supplies the established parsing and calendar arithmetic that a civil-date model needs without requiring global mutation. Alternatives considered were retaining validated strings, which keeps calendar arithmetic in our code, and the global Temporal shim, which mutates the runtime and makes its cost unavoidable.

## Consequences

Date values use the `temporal-polyfill/fns/PlainDate` operations directly; their records are not strings and do not have useful JavaScript object equality. `PlainDateSchema` is only the wire boundary, not a second temporal API. Bundle-sensitive mobile consumers should use the package's leaf exports rather than the coarse root namespace.

## Bundle evidence

With `temporal-polyfill@1.0.4` and esbuild `0.28.2`, a browser ESM probe importing `Calendar.getBasic` plus `PlainDate.fromString`, `toString`, `addDays`, `diffDays`, `dayOfWeek`, `weekOfYear`, and `yearOfWeek` measured 18,300 bytes minified and 7,046 bytes gzip. A deliberately non-tree-shaken proxy for Metro measured 107,615 bytes minified, 33,184 bytes gzip, and about 304,808 bytes of optimized Hermes bytecode. The mobile app's legacy compatibility model does not reach Temporal and therefore pays no present cost. Repeat the same import set and record minified, gzip, and Hermes output before mobile adopts the new API; tool or dependency upgrades invalidate the baseline.
