# Accepted legacy behavior catalogue

This index is the rewrite backlog extracted from the production Flutter app and corroborated or
extended by the archived React Native app. The linked scenario is the canonical statement of each
accepted rule, its example, evidence, state boundary, and provenance. Behavior that is ambiguous or
harmful is kept separately in [open-decisions.md](open-decisions.md).

All contracts currently target Android and iOS. A pending contract is intentional: its E2E
implementation waits until the rewrite has the named fixture and product surface.

## Activation and setup

- [Route incomplete setup to activation](../scenarios/startup.md)
- [Normalize licence-key entry](../scenarios/normalize-license-key-entry.md)
- [Reject an invalid licence key](../scenarios/reject-invalid-license-key.md)
- [Report a licence-check failure](../scenarios/report-license-check-failure.md)
- [Recover setup after reconnecting](../scenarios/recover-setup-after-reconnection.md)
- [Order available school years](../scenarios/order-available-school-years.md)
- [Collect a valid student profile](../scenarios/collect-valid-student-profile.md)
- [Select a class and optional courses](../scenarios/select-class-and-courses.md)
- [Use the only available class](../scenarios/use-the-only-available-class.md)
- [Preserve completed setup across relaunch](../scenarios/complete-setup-across-relaunch.md)
- [Restart interrupted setup safely](../scenarios/restart-interrupted-setup.md)

## Application shell and daily overview

- [Navigate between the main destinations](../scenarios/main-shell-navigation.md)
- [Adapt primary navigation to available width](../scenarios/main-shell-responsive-navigation.md)
- [Understand the current school-day agenda](../scenarios/overview-daily-agenda.md)
- [Advance to the next relevant school day](../scenarios/overview-next-school-day.md)
- [Treat free periods and completed lessons appropriately](../scenarios/overview-non-actionable-periods.md)
- [Show the relevant school holiday](../scenarios/overview-holiday.md)
- [Explain timetable substitutions](../scenarios/overview-substitution.md)
- [Refresh substitutions without losing the local schedule](../scenarios/overview-substitution-refresh-resilience.md)

## Weekly schedule

- [Browse calendar weeks](../scenarios/schedule-browse-weeks.md)
- [Open a course from its schedule cell](../scenarios/schedule-open-course.md)
- [Complete or skip the first-visit tutorial](../scenarios/schedule-first-visit-tutorial.md)
- [Cycle both/A/B recurrence](../scenarios/schedule-cycle-recurrence.md)
- [Move a scheduled course](../scenarios/schedule-move-course.md)
- [Add a course to the timetable](../scenarios/schedule-add-course.md)
- [Show current weekday and time context](../scenarios/schedule-current-time-context.md)
- [Overlay a holiday on its covered days](../scenarios/schedule-holiday-overlay.md)

Deletion and Save/Cancel semantics remain product decisions rather than inferred requirements.

## Profile, semesters, and course detail

- [Review profile identity and settings](../scenarios/profile-identity-and-settings.md)
- [Switch between semesters](../scenarios/profile-switch-semester.md)
- [Choose courses from an empty current semester](../scenarios/profile-choose-courses.md)
- [Open a historical course without current homework controls](../scenarios/profile-open-historical-course.md)
- [Edit profile details and courses](../scenarios/profile-edit-details-and-courses.md)
- [Review app identity, version, and legal notice](../scenarios/about-app-information.md)
- [Compose a pre-addressed feedback email](../scenarios/feedback-compose-email.md)

## Tasks and attachments

- [Create a task with required details](../scenarios/create-task-with-required-details.md)
- [Restrict task due dates](../scenarios/restrict-task-due-date.md)
- [Limit task description length](../scenarios/limit-task-description-length.md)
- [Attach a photo to a task](../scenarios/attach-photo-to-task.md)
- [Cancel photo selection without changing the task](../scenarios/cancel-task-photo-selection.md)
- [Toggle task completion](../scenarios/toggle-task-completion.md)
- [Order tasks by completion and due date](../scenarios/order-tasks-by-status-and-due-date.md)
- [Distinguish overdue tasks](../scenarios/distinguish-overdue-tasks.md)
- [Cancel or confirm task deletion](../scenarios/delete-task-with-confirmation.md)

Overdue and dimmed count calendar days, each one day later than in Flutter. A task is overdue from
the day after its due date and dimmed from the eighth day after it. Flutter compared the due
date's midnight with the current time, so a task turned red on its due date and dimmed on the
seventh day after it (`lib/features/tasks/tasks_view.dart:55-58`, `:102`). The rewrite follows the
overdue scenario's rule, a due date that has passed, in core's `Homework.isOverdue` and
`Homework.isDimmed`.

Archival semantics and legacy attachment-storage defects remain quarantined.

## Absences

- [Default absence entry to the next weekday](../scenarios/default-absence-to-next-weekday.md)
- [Require a reason and at least one course](../scenarios/require-absence-reason-and-course.md)
- [Explain a day without scheduled courses](../scenarios/prevent-absence-on-unscheduled-day.md)
- [Register one absence per selected course](../scenarios/register-scheduled-absence.md)
- [Group related lessons for parent confirmation](../scenarios/group-related-absences-for-parent.md)
- [Confirm a minor's absence in parent-teacher order](../scenarios/confirm-minor-absence-in-order.md)
- [Skip parent confirmation for an adult](../scenarios/skip-parent-confirmation-for-adult.md)
- [Cancel or confirm grouped absence deletion](../scenarios/delete-absence-group-with-confirmation.md)
- [Summarize outstanding absences](../scenarios/summarize-outstanding-absences.md)
- [Explain an empty absence history](../scenarios/show-empty-absence-summary.md)
- [Celebrate a fully excused history](../scenarios/show-all-absences-excused-summary.md)
- [Preserve and synchronize an offline-created absence](../scenarios/offline-absence-survives-and-converges.md)

## Grades, signatures, and local-first convergence

- [Accept only grade points from zero through fifteen](../scenarios/grade-points-validation.md)
- [Save a written grade within semester bounds](../scenarios/save-written-grade.md)
- [Save an oral grade](../scenarios/save-oral-grade.md)
- [Save a current overall grade](../scenarios/save-master-grade.md)
- [Calculate written averages from confirmed grades](../scenarios/written-average-uses-confirmed-grades.md)
- [Confirm a minor's grade in teacher-parent order](../scenarios/grade-signature-sequence.md)
- [Confirm an adult's grade with its teacher](../scenarios/adult-grade-teacher-confirmation.md)
- [Cancel signature capture without confirming](../scenarios/cancel-grade-signature.md)
- [Review signatures after relaunch](../scenarios/review-grade-signatures-after-relaunch.md)
- [Delete an unconfirmed written grade and lock confirmed deletion](../scenarios/delete-unconfirmed-written-grade.md)
- [Restore only the latest confirmed grade](../scenarios/restore-confirmed-grade.md)
- [Preserve an offline grade across relaunch](../scenarios/offline-grade-survives-relaunch.md)
- [Converge an offline grade across devices](../scenarios/reconnect-converges-grade-across-devices.md)
- [Replay missed updates on foreground resume](../scenarios/resume-replays-missed-grade.md)
- [Never replay an unauthorized grade action](../scenarios/unauthorized-grade-action-never-syncs.md)
- [Recover a missing course projection during replay](../scenarios/replay-recovers-missing-course.md)

## Permissions

- [Keep core workflows available after notification denial](../scenarios/notification-permission-is-optional.md)

Camera and photo permission behavior is covered at the task-attachment boundary. Notification timing
and tap destinations remain product decisions.

## Coverage that belongs below UI E2E

The archaeology also exposed important rules that are not usefully distinguished through UI-only
assertions. Preserve these in integration or domain tests when their implementation exists:

- SQLite schema upgrades retain user, semester, course, timetable, task, absence, grade, and
  signature state.
- Full versus incremental timetable refresh uses an explicit freshness policy.
- Failed refresh never advances the last-success marker.
- Server timetable replacement removes obsolete slots as well as inserting new ones.
- Manual timetable overrides are not overwritten by server refresh.
- Persisted stream offsets and event identities prevent duplicate replay.
- Missing-reference recovery retries the original event once and does not hide unrelated failures.
- Authorization is checked before sensitive events enter the offline outbox.
- Local writes, outbox append, projection updates, and acknowledgement boundaries are crash-safe.

These rules should still have visible boundary coverage through the linked offline/restart/reconnect
scenarios; lower-level tests provide the precise fault injection that mobile UI runners cannot.
