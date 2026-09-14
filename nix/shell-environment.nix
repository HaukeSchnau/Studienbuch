''
  export PATH="$PWD/node_modules/.bin:$PATH"

  # Testcontainers talks to a Docker-compatible socket. On rootless Podman hosts that
  # socket is per-user and DOCKER_HOST is not set for us, so point at it here rather than
  # from a wrapper script around the test runner.
  if [ -z "''${DOCKER_HOST:-}" ]; then
    podman_socket="''${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/podman/podman.sock"
    if [ -S "$podman_socket" ]; then
      export DOCKER_HOST="unix://$podman_socket"
      export TESTCONTAINERS_RYUK_DISABLED="''${TESTCONTAINERS_RYUK_DISABLED:-true}"
    fi
    unset podman_socket
  fi
''
