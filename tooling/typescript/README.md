# @stu/tsconfig

Shared TypeScript configuration presets for workspace packages.

## Files

- `base.json`: strict baseline compiler settings.
- `internal-package.json`: declaration-emitting package profile.

## Usage

In a package `tsconfig.json`:

```json
{
  "extends": "@stu/tsconfig/internal-package.json",
  "compilerOptions": {
    "rootDir": "src"
  },
  "include": ["src", "env.ts"]
}
```

## Notes

This package is intentionally config-only and is consumed by most workspace packages through `extends`.
