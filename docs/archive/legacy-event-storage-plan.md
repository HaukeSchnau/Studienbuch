# Legacy Event Storage Plan (Archived)

Status: archived historical note.

Source: previously stored at `packages/api/src/router/events/New-Plan.md`.

This document described an early concept based on MongoDB + Neo4j for event storage/relationships. The current architecture does **not** use that model.

Current canonical architecture references:

- `docs/architecture/runtime-topology.md`
- `docs/architecture/sync-and-events.md`
- `docs/adr/0001-standalone-api-mobile-priority.md`

## Historical Note

# New Plan for storing events and their relationships

## Storage

- Event data is stored in MongoDB (alternative: Postgres)
- Event metadata is stored in Neo4j
  - We store users, events and entities/aggregates as nodes
  - We store relationships between nodes as edges: All information that can be statically inferred from the event data
    - User <-> Event: Store whether a user has received an event (i.e. if it has been laid on their event stream)
    - Event <-> Entity: Option 2: A relation exists -> The event data contains an identifier for the entity. There exist relations between entities and users that specify who may have access.

## Querying the events

1. An event is ingested that causes the world view of a user to change
2. The system finds all events that are relevant to the user due to this change
   - User node (by id) -> Entity nodes -> Event node (exclude events that the user already knows, i.e. events that are related to the user)

## Ingesting events

1. An event is ingested
2. The system stores the event data in MongoDB
3. The system stores the event metadata in Neo4j
