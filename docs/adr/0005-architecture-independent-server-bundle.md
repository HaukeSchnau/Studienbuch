# Architecture-independent server bundle

Status: accepted 2026-10-28

CI builds one pure JavaScript bundle: the server, the landing page and console, the Expo web export and the migrations. A release pairs it with the host's own `nodejs_26` from nixpkgs. The bundle is built on the fastest builder, the x86_64 tower, and runs on the aarch64 srv-2 without cross builds or emulation.

That holds only while the server has no native addon. The flake check `closureGuard` fails on any `.node` file, on an `expo`, `react-native` or `metro` path in the server part, and above 100 MB. If a native addon ever becomes unavoidable, the server part becomes per architecture again.

Reasoning: [hosting.md, section 2](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/hosting.md#2-packaging).
