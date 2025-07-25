dev:
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
    open http://localhost:8081/_expo/plugins/expo-drizzle-studio-plugin
    open https://local.drizzle.studio/
    mprocs # See: mprocs.yaml, https://github.com/mirage-js/mprocs  
    # Clean up after dev
    docker compose -f docker-compose.yml -f docker-compose.dev.yml down

seed: 
    bin/console pull igs-lil

[working-directory: 'packages/app-mobile']
ios:
    bun run expo run:ios
