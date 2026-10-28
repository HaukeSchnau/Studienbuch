# Contributing to Studienbuch

Contributions are welcome. This document covers the two things that are specific to this project:
the contributor licence agreement, and how to get a working checkout.

## You need to sign the CLA

Studienbuch is source-available under the [Business Source License 1.1](./LICENSE), and Urbs UG
sells commercial licences for it. That only works if every line in the repository can be licensed
that way, so every contributor signs the [Contributor License Agreement](./CLA.md) once.

You keep the copyright in what you wrote. You grant Urbs UG a broad licence to ship it, including
under commercial terms. In return, every version containing your work is published as source and
converts to Apache 2.0 within four years. Read [`CLA.md`](./CLA.md) before you agree to it.

Signing is a comment on your first pull request. Open the PR, a bot replies with the exact sentence
to post, you post it, and the check goes green. There is nothing to print or email.

## Before you open a pull request

Open an issue first for anything larger than a bug fix. Studienbuch is offline-first, and changes
that look small in the UI often have consequences for sync, conflict resolution, or the local
database schema. It is much cheaper to discuss the approach than to rewrite the patch.

Read [`AGENTS.md`](./AGENTS.md). It describes the package roles, the directory naming rules, and
the taste this codebase is held to. Those rules are not optional decoration, they are why the
project is navigable.

## Getting a checkout running

Use devenv. `devenv.nix` and `nix/toolchain.nix` pin Node and pnpm, and the flake provides the
smaller shell CI uses.

```sh
devenv shell     # or `direnv allow` if you use direnv
pnpm install
vp check         # format, lint and type check
```

`vp check --fix` applies formatting and the auto-fixable lint rules. CI runs the same checks as
separate tasks in `.calder/ci.ts`.

The repository is in a from-scratch rewrite, and the apps arrive during its first milestone.
`AGENTS.md` describes the development environment as it grows.

## Where development happens

The canonical repository is at `git.schnau.dev`. GitHub is a mirror, and it is where pull requests
and issues from outside contributors are accepted.

## Commercial use

Contributing does not grant you a licence to run Studienbuch in a school. See
[`LICENSING.md`](./LICENSING.md).
