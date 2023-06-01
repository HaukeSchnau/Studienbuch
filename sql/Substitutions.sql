SELECT
    S.id,
    S.date,
    S."lessonStart",
    S."lessonEnd",
    S.type,
    C."courseId",
    Y.name AS "yearName",
    S.room
FROM
    "Substitution" S
    INNER JOIN "Course" C ON S."courseId" = C.id
    INNER JOIN "Year" Y ON C."yearId" = Y.id
ORDER BY S."date" DESC;