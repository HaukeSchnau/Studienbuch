# Accepted legacy behavior catalogue

This index is the rewrite backlog extracted from the production Flutter app and corroborated or
extended by the archived React Native app. The linked scenario is the canonical statement of each
accepted rule, its example, evidence, state boundary, and provenance. Behavior that is ambiguous or
harmful is kept separately in [open-decisions.md](open-decisions.md).

All contracts currently target Android and iOS. A pending contract is intentional: its paired
agent-device and Argent implementations must be recorded from the live rewrite only after the named
fixture and product surface exist.

## Activation and setup

- [Route incomplete setup to activation](../../../apps/mobile/e2e/scenarios/startup.md)
- [Normalize licence-key entry](../../../apps/mobile/e2e/scenarios/normalize-license-key-entry.md)
- [Reject an invalid licence key](../../../apps/mobile/e2e/scenarios/reject-invalid-license-key.md)
- [Report a licence-check failure](../../../apps/mobile/e2e/scenarios/report-license-check-failure.md)
- [Recover setup after reconnecting](../../../apps/mobile/e2e/scenarios/recover-setup-after-reconnection.md)
- [Order available school years](../../../apps/mobile/e2e/scenarios/order-available-school-years.md)
- [Collect a valid student profile](../../../apps/mobile/e2e/scenarios/collect-valid-student-profile.md)
- [Select a class and optional courses](../../../apps/mobile/e2e/scenarios/select-class-and-courses.md)
- [Use the only available class](../../../apps/mobile/e2e/scenarios/use-the-only-available-class.md)
- [Preserve completed setup across relaunch](../../../apps/mobile/e2e/scenarios/complete-setup-across-relaunch.md)
- [Restart interrupted setup safely](../../../apps/mobile/e2e/scenarios/restart-interrupted-setup.md)

## Application shell and daily overview

- [Navigate between the main destinations](../../../apps/mobile/e2e/scenarios/main-shell-navigation.md)
- [Adapt primary navigation to available width](../../../apps/mobile/e2e/scenarios/main-shell-responsive-navigation.md)
- [Understand the current school-day agenda](../../../apps/mobile/e2e/scenarios/overview-daily-agenda.md)
- [Advance to the next relevant school day](../../../apps/mobile/e2e/scenarios/overview-next-school-day.md)
- [Treat free periods and completed lessons appropriately](../../../apps/mobile/e2e/scenarios/overview-non-actionable-periods.md)
- [Show the relevant school holiday](../../../apps/mobile/e2e/scenarios/overview-holiday.md)
- [Explain timetable substitutions](../../../apps/mobile/e2e/scenarios/overview-substitution.md)
- [Refresh substitutions without losing the local schedule](../../../apps/mobile/e2e/scenarios/overview-substitution-refresh-resilience.md)

## Weekly schedule

- [Browse calendar weeks](../../../apps/mobile/e2e/scenarios/schedule-browse-weeks.md)
- [Open a course from its schedule cell](../../../apps/mobile/e2e/scenarios/schedule-open-course.md)
- [Complete or skip the first-visit tutorial](../../../apps/mobile/e2e/scenarios/schedule-first-visit-tutorial.md)
- [Cycle both/A/B recurrence](../../../apps/mobile/e2e/scenarios/schedule-cycle-recurrence.md)
- [Move a scheduled course](../../../apps/mobile/e2e/scenarios/schedule-move-course.md)
- [Add a course to the timetable](../../../apps/mobile/e2e/scenarios/schedule-add-course.md)
- [Show current weekday and time context](../../../apps/mobile/e2e/scenarios/schedule-current-time-context.md)
- [Overlay a holiday on its covered days](../../../apps/mobile/e2e/scenarios/schedule-holiday-overlay.md)

Deletion and Save/Cancel semantics remain product decisions rather than inferred requirements.

## Profile, semesters, and course detail

- [Review profile identity and settings](../../../apps/mobile/e2e/scenarios/profile-identity-and-settings.md)
- [Switch between semesters](../../../apps/mobile/e2e/scenarios/profile-switch-semester.md)
- [Choose courses from an empty current semester](../../../apps/mobile/e2e/scenarios/profile-choose-courses.md)
- [Open a historical course without current homework controls](../../../apps/mobile/e2e/scenarios/profile-open-historical-course.md)
- [Edit profile details and courses](../../../apps/mobile/e2e/scenarios/profile-edit-details-and-courses.md)
- [Review app identity, version, and legal notice](../../../apps/mobile/e2e/scenarios/about-app-information.md)
- [Compose a pre-addressed feedback email](../../../apps/mobile/e2e/scenarios/feedback-compose-email.md)

## Tasks and attachments

- [Create a task with required details](../../../apps/mobile/e2e/scenarios/create-task-with-required-details.md)
- [Restrict task due dates](../../../apps/mobile/e2e/scenarios/restrict-task-due-date.md)
- [Limit task description length](../../../apps/mobile/e2e/scenarios/limit-task-description-length.md)
- [Attach a photo to a task](../../../apps/mobile/e2e/scenarios/attach-photo-to-task.md)
- [Cancel photo selection without changing the task](../../../apps/mobile/e2e/scenarios/cancel-task-photo-selection.md)
- [Toggle task completion](../../../apps/mobile/e2e/scenarios/toggle-task-completion.md)
- [Order tasks by completion and due date](../../../apps/mobile/e2e/scenarios/order-tasks-by-status-and-due-date.md)
- [Distinguish overdue tasks](../../../apps/mobile/e2e/scenarios/distinguish-overdue-tasks.md)
- [Cancel or confirm task deletion](../../../apps/mobile/e2e/scenarios/delete-task-with-confirmation.md)

Archival semantics and legacy attachment-storage defects remain quarantined.

## Absences

- [Default absence entry to the next weekday](../../../apps/mobile/e2e/scenarios/default-absence-to-next-weekday.md)
- [Require a reason and at least one course](../../../apps/mobile/e2e/scenarios/require-absence-reason-and-course.md)
- [Explain a day without scheduled courses](../../../apps/mobile/e2e/scenarios/prevent-absence-on-unscheduled-day.md)
- [Register one absence per selected course](../../../apps/mobile/e2e/scenarios/register-scheduled-absence.md)
- [Group related lessons for parent confirmation](../../../apps/mobile/e2e/scenarios/group-related-absences-for-parent.md)
- [Confirm a minor's absence in parent-teacher order](../../../apps/mobile/e2e/scenarios/confirm-minor-absence-in-order.md)
- [Skip parent confirmation for an adult](../../../apps/mobile/e2e/scenarios/skip-parent-confirmation-for-adult.md)
- [Cancel or confirm grouped absence deletion](../../../apps/mobile/e2e/scenarios/delete-absence-group-with-confirmation.md)
- [Summarize outstanding absences](../../../apps/mobile/e2e/scenarios/summarize-outstanding-absences.md)
- [Explain an empty absence history](../../../apps/mobile/e2e/scenarios/show-empty-absence-summary.md)
- [Celebrate a fully excused history](../../../apps/mobile/e2e/scenarios/show-all-absences-excused-summary.md)
- [Preserve and synchronize an offline-created absence](../../../apps/mobile/e2e/scenarios/offline-absence-survives-and-converges.md)

## Grades, signatures, and local-first convergence

- [Accept only grade points from zero through fifteen](../../../apps/mobile/e2e/scenarios/grade-points-validation.md)
- [Save a written grade within semester bounds](../../../apps/mobile/e2e/scenarios/save-written-grade.md)
- [Save an oral grade](../../../apps/mobile/e2e/scenarios/save-oral-grade.md)
- [Save a current overall grade](../../../apps/mobile/e2e/scenarios/save-master-grade.md)
- [Calculate written averages from confirmed grades](../../../apps/mobile/e2e/scenarios/written-average-uses-confirmed-grades.md)
- [Confirm a minor's grade in teacher-parent order](../../../apps/mobile/e2e/scenarios/grade-signature-sequence.md)
- [Confirm an adult's grade with its teacher](../../../apps/mobile/e2e/scenarios/adult-grade-teacher-confirmation.md)
- [Cancel signature capture without confirming](../../../apps/mobile/e2e/scenarios/cancel-grade-signature.md)
- [Review signatures after relaunch](../../../apps/mobile/e2e/scenarios/review-grade-signatures-after-relaunch.md)
- [Delete an unconfirmed written grade and lock confirmed deletion](../../../apps/mobile/e2e/scenarios/delete-unconfirmed-written-grade.md)
- [Restore only the latest confirmed grade](../../../apps/mobile/e2e/scenarios/restore-confirmed-grade.md)
- [Preserve an offline grade across relaunch](../../../apps/mobile/e2e/scenarios/offline-grade-survives-relaunch.md)
- [Converge an offline grade across devices](../../../apps/mobile/e2e/scenarios/reconnect-converges-grade-across-devices.md)
- [Replay missed updates on foreground resume](../../../apps/mobile/e2e/scenarios/resume-replays-missed-grade.md)
- [Never replay an unauthorized grade action](../../../apps/mobile/e2e/scenarios/unauthorized-grade-action-never-syncs.md)
- [Recover a missing course projection during replay](../../../apps/mobile/e2e/scenarios/replay-recovers-missing-course.md)

## Permissions

- [Keep core workflows available after notification denial](../../../apps/mobile/e2e/scenarios/notification-permission-is-optional.md)

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
