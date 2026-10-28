# No Justfile

Status: accepted 2026-10-28 ([D16](https://files.schnau.dev/html/studienbuch-roadmap/#D16))

Every command has one home. Tools that need no wrapper run directly (`vp check`, `vp test`). A package's commands are scripts in its `package.json`, run with `vp run`. Long-running dev processes belong to devenv. CI is `.calder/ci.ts`, and `calder check` runs it on the working copy before every push, which replaces `just qa`.

Calder runs each check as its own task, so a Justfile was a second list of the same commands, and most recipes wrapped tools that have their own CLI. Scripts with logic are TypeScript files run with `node`, owned by the package they serve.

Reasoning: [stack.md, commands](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/stack.md#commands-justfile-package-scripts-calder).
