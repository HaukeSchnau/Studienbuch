# Project-agnostic Nix library

This directory contains modules that do not know Studienbuch application names,
runtime actions, tool versions, or repository policy. They remain local until a
second repository proves that their interface provides enough leverage to move
into `nix-infra-modules`.

## Modules

- `pnpm-workspace-source.nix` discovers pnpm workspace packages, derives their
  transitive local dependency graph, and creates minimal dependency and package
  source trees. Project-specific naming, package files, patch layout, and source
  exclusions enter through its constructor interface.
