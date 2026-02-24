# @stu/tailwind-config

Shared Tailwind configuration package for web and native surfaces.

## Exports

- `@stu/tailwind-config/web`
- `@stu/tailwind-config/native`

## Responsibilities

- Define shared color tokens and base config.
- Provide web-specific plugin wiring (`tailwindcss-animate`).
- Provide native-specific color/token overrides.

## Key Files

- `base.ts`: shared base tokens and defaults.
- `web.ts`: web preset composition.
- `native.ts`: native preset composition.

## Scripts

```bash
bun --filter @stu/tailwind-config lint
bun --filter @stu/tailwind-config lint
```
