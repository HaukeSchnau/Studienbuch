DROP VIEW `Choice`;--> statement-breakpoint
CREATE VIEW `Choice` AS select space, id, data ->> '$."course"' as "course", data ->> '$."comment"' as "comment" from sync_row_view where tbl = 'Choice';