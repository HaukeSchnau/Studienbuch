# Model civil time explicitly

Status: accepted 2026-08-15, amended 2026-10-28

School rules are about calendar dates and times of day, not instants. Core represents a date as a Temporal `PlainDate` record, encoded as an ISO 8601 string at storage and transport boundaries, and a time of day as milliseconds since midnight. Date ranges are closed, time ranges half-open. Audit timestamps use Effect's `DateTime.Utc`, zoned instants `DateTime.Zoned`, and elapsed time `Duration`. JavaScript `Date`, time zones and string ordering then can't move a school day.

Amended for the rewrite: "now" is a civil date and time in the school's time zone (`rules.timeZone` in the School row), and it reaches a mutator as an argument, because mutators never read a clock. ISO weeks come from Temporal, which fixes the legacy app's week 53 bug.

Temporal comes from the functional API of `temporal-polyfill`. Hermes has no `Temporal`, and the global shim mutates the runtime, so lint bans the `Temporal` global. Validated strings were rejected because they keep calendar arithmetic in our code. In August, the import set the app needs measured 7 KB gzip tree-shaken and 33 KB gzip without tree shaking, Metro's default. Measure it again on Hermes when the app first imports it.

Reasoning: [domain.md, section 4](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/domain.md#4-critical-review-of-what-we-had).
