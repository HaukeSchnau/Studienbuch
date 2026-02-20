{ pkgs, lib }:
let
  mkWorkspaceScript =
    {
      name,
      text,
      runtimeInputs ? [ ],
    }:
    pkgs.writeShellApplication {
      inherit name text;
      runtimeInputs = [
        pkgs.bun
        pkgs.coreutils
        pkgs.git
        pkgs.nodejs_22
      ] ++ runtimeInputs;
    };

  repoPrelude = ''
    set -euo pipefail
    if git_root="$(git rev-parse --show-toplevel 2>/dev/null)"; then
      cd "$git_root"
    fi
  '';

  installWorkspaceDeps = ''
    export NPM_CONFIG_REGISTRY="https://npm.schnau.dev/"
    export BUN_CONFIG_REGISTRY="https://npm.schnau.dev/"
    lock_hash="no-lock"
    if [ -f bun.lock ]; then
      lock_hash="$(sha256sum bun.lock | awk '{print $1}')"
    fi
    shared_cache_base="''${STUDIENBUCH_BUN_SHARED_CACHE_BASE:-/tmp/studienbuch-bun-cache}"
    shared_tmp_base="''${STUDIENBUCH_BUN_SHARED_TMP_BASE:-/var/tmp/studienbuch-bun-tmp}"
    shared_install_base="''${STUDIENBUCH_BUN_SHARED_INSTALL_BASE:-/var/tmp/studienbuch-bun-install}"

    choose_writable_dir() {
      candidate="$1"
      fallback="$2"
      if mkdir -p "$candidate" 2>/dev/null && [ -w "$candidate" ]; then
        printf '%s' "$candidate"
      else
        mkdir -p "$fallback"
        printf '%s' "$fallback"
      fi
    }

    cache_dir="$(choose_writable_dir "$shared_cache_base/$lock_hash" "$TMPDIR/bun-cache")"
    bun_tmp_dir="$(choose_writable_dir "$shared_tmp_base/$lock_hash" "$TMPDIR/bun-tmp")"
    bun_install_dir="$(choose_writable_dir "$shared_install_base/$lock_hash" "$TMPDIR/bun-install")"
    xdg_runtime_dir="$(choose_writable_dir "$TMPDIR/xdg-runtime" "$TMPDIR/xdg-runtime")"

    export BUN_CACHE_DIR="''${BUN_CACHE_DIR:-$cache_dir}"
    export BUN_TMPDIR="''${BUN_TMPDIR:-$bun_tmp_dir}"
    export BUN_INSTALL="''${BUN_INSTALL:-$bun_install_dir}"
    export XDG_RUNTIME_DIR="''${XDG_RUNTIME_DIR:-$xdg_runtime_dir}"
    chmod 700 "$XDG_RUNTIME_DIR" 2>/dev/null || true

    attempts=0
    until TMPDIR="$BUN_TMPDIR" bun install --frozen-lockfile --ignore-scripts --cache-dir "$BUN_CACHE_DIR"; do
      attempts=$((attempts + 1))
      if [ "$attempts" -ge 3 ]; then
        echo "bun install failed after $attempts attempts" >&2
        exit 1
      fi

      echo "bun install failed (attempt $attempts), retrying..." >&2
      sleep 2
    done
  '';

  buildApi = mkWorkspaceScript {
    name = "stu-build-api";
    text = ''
      ${repoPrelude}
      ${installWorkspaceDeps}

      cd packages/api
      NODE_ENV=production bun ./build/build-node.ts
    '';
  };

  buildConsole = mkWorkspaceScript {
    name = "stu-build-console";
    text = ''
      ${repoPrelude}
      ${installWorkspaceDeps}

      cd packages/console
      NODE_ENV=production bun ./build/build-node.ts
    '';
  };

  buildAll = mkWorkspaceScript {
    name = "stu-build-all";
    runtimeInputs = [
      buildApi
      buildConsole
    ];
    text = ''
      ${repoPrelude}

      stu-build-api
      stu-build-console
    '';
  };

  migrate = mkWorkspaceScript {
    name = "stu-migrate";
    text = ''
      ${repoPrelude}
      ${installWorkspaceDeps}

      cd packages/db
      bunx drizzle-kit migrate --config drizzle.config.ts "$@"
    '';
  };

  startApi = mkWorkspaceScript {
    name = "stu-start-api";
    runtimeInputs = [ buildApi ];
    text = ''
      ${repoPrelude}

      if [ ! -f packages/api/dist/node.js ]; then
        stu-build-api
      fi

      exec node packages/api/dist/node.js "$@"
    '';
  };

  startConsole = mkWorkspaceScript {
    name = "stu-start-console";
    runtimeInputs = [ buildConsole ];
    text = ''
      ${repoPrelude}

      if [ ! -f packages/console/dist/console.js ]; then
        stu-build-console
      fi

      exec node packages/console/dist/console.js "$@"
    '';
  };

  exportOciArchives = mkWorkspaceScript {
    name = "stu-export-oci-archives";
    text = ''
      ${repoPrelude}

      out_dir=''${1:-./.artifacts/oci}
      mkdir -p "$out_dir"
      cp "$(nix path-info .#packages.aarch64-linux.oci-api-archive)" "$out_dir/studienbuch-api-nix.oci.tar"
      cp "$(nix path-info .#packages.aarch64-linux.oci-console-cron-archive)" "$out_dir/studienbuch-console-cron-nix.oci.tar"
      cp "$(nix path-info .#packages.aarch64-linux.oci-migrations-archive)" "$out_dir/studienbuch-migrations-nix.oci.tar"
      cp "$(nix path-info .#packages.aarch64-linux.oci-nextjs-archive)" "$out_dir/studienbuch-nextjs-nix.oci.tar"
      cp "$(nix path-info .#packages.aarch64-linux.oci-admin-panel-archive)" "$out_dir/studienbuch-admin-panel-nix.oci.tar"
    '';
  };

  loadOciArchives = mkWorkspaceScript {
    name = "stu-load-oci-archives";
    runtimeInputs = [ pkgs.skopeo ];
    text = ''
      ${repoPrelude}

      archive_dir=''${1:-}
      if [ -n "$archive_dir" ]; then
        api_archive="$archive_dir/studienbuch-api-nix.oci.tar"
        console_archive="$archive_dir/studienbuch-console-cron-nix.oci.tar"
        migrations_archive="$archive_dir/studienbuch-migrations-nix.oci.tar"
        nextjs_archive="$archive_dir/studienbuch-nextjs-nix.oci.tar"
        admin_panel_archive="$archive_dir/studienbuch-admin-panel-nix.oci.tar"

        if [ ! -f "$api_archive" ] || [ ! -f "$console_archive" ] || [ ! -f "$migrations_archive" ] || [ ! -f "$nextjs_archive" ] || [ ! -f "$admin_panel_archive" ]; then
          echo "Missing OCI archives under $archive_dir."
          exit 1
        fi
      else
        api_archive="$(nix path-info .#packages.aarch64-linux.oci-api-archive)"
        console_archive="$(nix path-info .#packages.aarch64-linux.oci-console-cron-archive)"
        migrations_archive="$(nix path-info .#packages.aarch64-linux.oci-migrations-archive)"
        nextjs_archive="$(nix path-info .#packages.aarch64-linux.oci-nextjs-archive)"
        admin_panel_archive="$(nix path-info .#packages.aarch64-linux.oci-admin-panel-archive)"
      fi

      state_dir="''${XDG_STATE_HOME:-$HOME/.local/state}/studienbuch"
      state_file="$state_dir/oci-load-state"
      mkdir -p "$state_dir"
      touch "$state_file"

      load_if_changed() {
        image_name="$1"
        archive_path="$2"
        source_ref="oci-archive:$archive_path"
        target_ref="docker-daemon:$image_name:nix"
        archive_digest="$(sha256sum "$archive_path" | awk '{print $1}')"
        target_digest="$(skopeo inspect --format '{{.Digest}}' "$target_ref" 2>/dev/null || true)"
        previous_entry="$(awk -v image="$image_name" '$1 == image {print $0}' "$state_file" | tail -n1)"
        previous_archive_digest="$(printf '%s\n' "$previous_entry" | awk '{print $2}')"
        previous_target_digest="$(printf '%s\n' "$previous_entry" | awk '{print $3}')"

        if [ -n "$target_digest" ] && [ "$previous_archive_digest" = "$archive_digest" ] && [ "$previous_target_digest" = "$target_digest" ]; then
          echo "Skipping $image_name:nix (archive + daemon digest unchanged)"
          return 0
        fi

        if [ -n "$target_digest" ]; then
          echo "Loading $image_name:nix (daemon digest changed or archive updated)"
        else
          echo "Loading $image_name:nix (not present in daemon)"
        fi

        skopeo --insecure-policy copy "$source_ref" "$target_ref"
        new_target_digest="$(skopeo inspect --format '{{.Digest}}' "$target_ref")"
        awk -v image="$image_name" '$1 != image {print $0}' "$state_file" > "$state_file.tmp"
        printf '%s %s %s\n' "$image_name" "$archive_digest" "$new_target_digest" >> "$state_file.tmp"
        mv "$state_file.tmp" "$state_file"
      }

      load_if_changed "studienbuch-api" "$api_archive"
      load_if_changed "studienbuch-console-cron" "$console_archive"
      load_if_changed "studienbuch-migrations" "$migrations_archive"
      load_if_changed "studienbuch-nextjs" "$nextjs_archive"
      load_if_changed "studienbuch-admin-panel" "$admin_panel_archive"
    '';
  };

  basePackages = {
    "build-api" = buildApi;
    "build-console" = buildConsole;
    "build-all" = buildAll;
    "oci-export-archives" = exportOciArchives;
    "oci-load-archives" = loadOciArchives;
    migrations = migrate;
    "start-api" = startApi;
    "start-console" = startConsole;
    default = buildAll;
  };

  apps = {
    "build-api" = {
      type = "app";
      program = "${buildApi}/bin/stu-build-api";
      meta.description = "Build the @stu/api Node bundle with Bun.";
    };
    "build-console" = {
      type = "app";
      program = "${buildConsole}/bin/stu-build-console";
      meta.description = "Build the @stu/console Node bundle with Bun.";
    };
    "build-all" = {
      type = "app";
      program = "${buildAll}/bin/stu-build-all";
      meta.description = "Build both API and console bundles.";
    };
    "oci-export-archives" = {
      type = "app";
      program = "${exportOciArchives}/bin/stu-export-oci-archives";
      meta.description = "Export OCI archives to .artifacts/oci.";
    };
    "oci-load-archives" = {
      type = "app";
      program = "${loadOciArchives}/bin/stu-load-oci-archives";
      meta.description = "Load OCI archives (API, console-cron, migrations, Next.js, TanStack Start) into the local Docker daemon.";
    };
    migrations = {
      type = "app";
      program = "${migrate}/bin/stu-migrate";
      meta.description = "Run Drizzle migrations for @stu/db.";
    };
    "start-api" = {
      type = "app";
      program = "${startApi}/bin/stu-start-api";
      meta.description = "Start the built API server.";
    };
    "start-console" = {
      type = "app";
      program = "${startConsole}/bin/stu-start-console";
      meta.description = "Start the built console CLI.";
    };
  };
in
{
  inherit installWorkspaceDeps;
  packages = basePackages;
  inherit apps;
}
