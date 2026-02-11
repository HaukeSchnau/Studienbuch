# Generals

- a topic bundles events that a well-defined group of people should be aware of
- whenever a subscriber encounters a reference to an entity it does not know, it should ask the server for a snapshot of the entity

# Topics

## Course Topic

- create a topic for each course. every student that is enrolled in a course should be subscribed to the topic.
- events
  - org.courses.created
  - org.timetable.entryCreated
  - org.timetable.substituted
  - org.timetable.canceled
- snapshots
  - teachers

## Year Topic

- events
  - org.holiday.created
  - org.year.started
  - org.school.founded
- snapshots
  - teachers

## User Topic (Private)

- create one topic per student/user for sensitive personal data.
- naming convention:
  - `students.user.<studentId>`
- events:
  - absence.recorded
  - absence.parentApproved
  - absence.teacherApproved
  - absence.discarded
  - grades.currentGradeSet
  - grades.writtenGradeRecorded
  - grades.teacherApproved
  - grades.parentApproved
  - grades.discarded
  - grades.latestRestored
- snapshots:
  - current student profile + class membership
  - current absences state
  - current grades state

In other words, for a given event, we know which topics the event should be published to.
