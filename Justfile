dev:
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
    open http://localhost:8081/_expo/plugins/expo-drizzle-studio-plugin
    open https://local.drizzle.studio/
    mprocs

seed: 
    bin/console pull igs-lil
