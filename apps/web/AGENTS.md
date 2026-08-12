We use Sentry for deployed crash/error reporting and privacy-configured error-only replay. Effect and OpenTelemetry own traces, logs, metrics, and application instrumentation.

## Error collection

Error collection is automatic and configured in `src/router.tsx`.

## Instrumentation

- Put server workflows behind named Effect services and use `Effect.fn` or `Effect.withSpan` at meaningful boundaries.
- Use the shared `@stu/observability` vocabulary for resource identity, attributes, metrics, and client telemetry.
- Keep route and server-function handlers thin: decode, call an Effect service through the process-wide runtime, and map the typed result.
- Do not add `Sentry.startSpan`, Sentry performance integrations, arbitrary metric labels, request bodies, query strings, or student/domain data to operational telemetry.
- Sentry must keep `sendDefaultPii` disabled, normal-session replay disabled, and text/media/input masking enabled.

# shadcn instructions

Use the latest version of Shadcn to install new components, like this command to add a button component:

```bash
vp dlx shadcn@latest add button
```
