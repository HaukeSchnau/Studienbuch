UPDATE "users" AS account
SET "name" = profile."displayName", "updatedAt" = now()
FROM (
	SELECT DISTINCT ON (access."userId")
		access."userId",
		left(btrim(notebook."displayName"), 120) AS "displayName"
	FROM "notebook_profiles" AS notebook
	INNER JOIN "school_accesses" AS access ON access."id" = notebook."schoolAccessId"
	WHERE btrim(notebook."displayName") <> ''
	ORDER BY access."userId", notebook."createdAt", notebook."schoolAccessId"
) AS profile
WHERE account."id" = profile."userId"
	AND account."name" = 'Studienbuch-Konto';--> statement-breakpoint
DROP TABLE "operator_setup_tokens";--> statement-breakpoint
ALTER TABLE "notebook_profiles" DROP COLUMN "displayName";
