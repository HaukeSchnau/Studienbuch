# Infrastructure

- Vendor services
  - Postgres (Management data store)
  - LibSQL / SQLite (Student data store)
  - MongoDB (Event data store)
  - Neo4j (Event metadata store)
  - RabbitMQ (Event bus)
- Custom services (by priority)
  - HTTP API (ingesting and reading events, aswell as some RPC endpoints). May split this into multiple services
  - Console / Ran via cron job (or similar)
  - Admin dashboard
  - Website, purely presentational
