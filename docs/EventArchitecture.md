# Requirements

- App should work offline in most cases (exceptions e.g. login, setup, assign course, etc.)
- Whenever user is online, app should sync data with server
- Absence and grade data must sync across devices for the same user

# Architecture

- Every action taken by the mobile client is written to a local event log.
- The event is verified and applied locally immediately (optimistic local-first UX).
- The sync engine sends unsynced events to the standalone API whenever online.
- The API verifies, applies, and stores canonical events.
- The API publishes relevant events to user/topic streams so other clients can catch up.
- Clients reconnect using an offset and receive missing events before live events.

## Source Of Truth

- Canonical state: server-side Postgres read model + canonical event storage.
- Local state: device SQLite read model + local event log.
- Transport: SSE (`GET /api/events`) and ingest (`POST /api/events`) via standalone API.

## What if an event can't be applied locally?

Most events will reference some entity (e.g. course, assignment, etc.). Most of the time, these entities are already present in the local database due to other events intiated locally.
However, after certain events, a user might require some data from the server, i.e. after a course was assigned to a user or after registering a user at a school with a class and year. These events may be initiated by the user themselves or by the system/another user. In every case, the user will require the data from the server.

The possibility for this to happen is signaled by the entity IDs contained in the event. The server can keep track of which entities exist, when they were last updated and which users have access to them, including the time of the last update from the perspective of that user.

If the server sends an event to a user that references an entity, it checks if the user has access to that entity. If not, or if the user's local database is outdated, the server will send the entity to the user as a snapshot. The form of the snapshot is defined by the specific applicator.

From this point on, whenever an event occurs that is related to that entity, the server will send the event to the user as it is now known to the server. This means that this snapshot exchange is only needed to catch up the user to the latest state whenever their world view suddenly expands.

## What about transitive dependencies?

If a user is assigned to a course, the user requires the course, in its entirety. That includes all the teachers, the room, the class, the timetable entries, etc.

## Sync Invariants

- Idempotent ingest: duplicate event IDs are rejected.
- Ordered replay per user stream.
- Offset-driven reconnect for resumable sync.
- No silent drops: every mobile-emitted event namespace must have a server applicator.
- Sensitive events (absence/grades) are scoped to user-private topics.
- Sensitive events (absence/grades) must carry `studentId` in the payload for deterministic auth/topic mapping.
