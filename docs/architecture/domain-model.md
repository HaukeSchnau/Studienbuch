# Domain Model

The following ER-style map captures the core educational model used across server and client repositories.

```mermaid
erDiagram
    State 1 -- 0+ School : has
    State 1 -- 0+ Holiday : has

    Semester 1+ -- 1+ Year : has
    Semester 1 -- 0+ Course : "is taught in"

    School 1 -- 0+ Year : has
    School 1 -- 1+ Semester : has

    Year 1 -- 1+ Class : has

    Class 1 -- 0+ Student : enrolls
    Class 0+ -- 1+ Teacher : teaches
    Class 1+ -- 0+ Course : "is taught in"

    Course 0+ -- 0+ Student : enrolls
    Course 0+ -- 1+ Teacher : teaches
    Course 1 -- 0+ TimetableEntry : has

    Student 1 -- 0+ Grade : has
    Student 1 -- 0+ Absence : has

    User 1 -- zero or one Student : is
    User 1 -- zero or one Teacher : is
```

## Package Ownership of Domain Concerns

- `@stu/lib`: source of truth for domain types, event contracts, repository logic helpers, and snapshot contracts.
- `@stu/db`: Postgres implementation of repositories and applicators.
- `@stu/student`: SQLite implementation for mobile/student local state.

## Consistency Patterns

- Shared repository logic in `@stu/lib/src/repository-logic/*` is reused by both DB-backed packages to reduce divergence.
- Schema parity tests in `@stu/db` and `@stu/student` validate cross-storage contract alignment.
- Student-sensitive events (absence/grade) use explicit `studentId` payloads for deterministic authorization/topic mapping.
