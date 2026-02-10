dev:
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
    open http://localhost:8081/_expo/plugins/expo-drizzle-studio-plugin
    open https://local.drizzle.studio/
    mprocs # See: mprocs.yaml, https://github.com/mirage-js/mprocs  
    # Clean up after dev
    docker compose -f docker-compose.yml -f docker-compose.dev.yml down

seed: 
    bin/console pull igs-lil

check:
    bun run typecheck
    bun run lint:fix

[working-directory: 'packages/app-mobile']
ios:
    bun run expo run:ios

install:
    bun install

install-clean:
    find . -name "node_modules" -type d -exec rm -rf {} +
    bun install

stats:
  nix-shell -p cloc --run "git ls-files . | xargs cloc"

