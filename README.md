# Studienbuch Monorepo

## Development Setup

Copy the `.env.example` file to `.env` and fill in the necessary values.

```bash
pnpm install

createdb studienbuch # Create the database
pnpm db:push # Pushes the database schema to the database

pnpm dev:internal # Compiles the TS files of the internal packages

scripts/console seed igs-lil # Seeds the database with some data
scripts/console import-timetable igs-lil # Imports the current timetable
```
