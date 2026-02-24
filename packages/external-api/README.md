# @stu/external-api

Typed and resilient integrations for external services.

## Responsibilities

- Untis integration (auth + timetable/teacher/class/year fetchers).
- Holidays API client and wrappers.
- Linear API integration helpers.
- Shared HTTP resilience utilities.

## Public Surface

From `src/index.ts`:
- holidays helpers
- HTTP resilience helpers
- Linear module
- Untis module

## Key Files

- `src/untis/`: Untis login/fetchers/tests.
- `src/holidays/`: wrapper and generated OpenAPI client.
- `src/http/resilience.ts`: retry/resilience wiring.
- `src/linear/`: Linear API integration.

## Scripts

```bash
bun --filter @stu/external-api lint
bun --filter @stu/external-api typecheck
bun --filter @stu/external-api generate
```

`generate` refreshes the holidays OpenAPI client.

## Testing

Includes integration-style test suites in `src/untis/*.test.ts` and `src/holidays/holidays.test.ts`.

## Internal Dependencies

- `@stu/lib`
