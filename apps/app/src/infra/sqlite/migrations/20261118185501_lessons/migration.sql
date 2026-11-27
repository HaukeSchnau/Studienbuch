CREATE INDEX `base_row_Lesson_date` ON `base_row` (space,data ->> '$."date"',id) WHERE tbl = 'Lesson';--> statement-breakpoint
CREATE INDEX `pending_row_Lesson_date` ON `pending_row` (space,data ->> '$."date"',id) WHERE tbl = 'Lesson';--> statement-breakpoint
DROP VIEW `Course`;--> statement-breakpoint
CREATE VIEW `Closure` AS select space, id, data ->> '$."name"' as "name", data -> '$."dates"' as "dates" from sync_row_view where tbl = 'Closure';--> statement-breakpoint
CREATE VIEW `ImportStatus` AS select space, id, data ->> '$."observedAt"' as "observedAt", data ->> '$."coveredUntil"' as "coveredUntil" from sync_row_view where tbl = 'ImportStatus';--> statement-breakpoint
CREATE VIEW `Lesson` AS select space, id, data ->> '$."courseId"' as "courseId", data ->> '$."date"' as "date", data ->> '$."start"' as "start", data ->> '$."end"' as "end", data -> '$."teacherIds"' as "teacherIds", data -> '$."roomIds"' as "roomIds", data ->> '$."status"' as "status", data -> '$."change"' as "change" from sync_row_view where tbl = 'Lesson';--> statement-breakpoint
CREATE VIEW `Room` AS select space, id, data ->> '$."name"' as "name" from sync_row_view where tbl = 'Room';--> statement-breakpoint
CREATE VIEW `Teacher` AS select space, id, data ->> '$."shortName"' as "shortName" from sync_row_view where tbl = 'Teacher';--> statement-breakpoint
CREATE VIEW `WeekLabel` AS select space, id, data ->> '$."label"' as "label" from sync_row_view where tbl = 'WeekLabel';--> statement-breakpoint
CREATE VIEW `Course` AS select space, id, data ->> '$."name"' as "name", data ->> '$."subjectId"' as "subjectId", data ->> '$."level"' as "level" from sync_row_view where tbl = 'Course';