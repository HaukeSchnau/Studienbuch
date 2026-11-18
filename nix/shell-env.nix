# Variables that CI's shell (flake.nix) and the dev shell (devenv.nix) both set.
{ pkgs }:
pkgs.lib.optionalAttrs pkgs.stdenv.hostPlatform.isLinux {
  # apps/app's browser tests run headless Chromium and Firefox through Playwright, which the catalog
  # pins to nixpkgs' version. Headless Chromium is the headless shell, so the full browser, WebKit and
  # ffmpeg stay out: 1.4 GB instead of 2.4 GB.
  PLAYWRIGHT_BROWSERS_PATH = pkgs.playwright-driver.browsers.override {
    withChromium = false;
    withWebkit = false;
    withFfmpeg = false;
  };
}
