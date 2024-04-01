import 'package:class_mate/database/database.dart';
import 'package:class_mate/models/semester.dart';

Future<void> copyCoursesFromPreviousSemester(
    SemesterId currentSemesterId) async {
  final previousSemesterId = currentSemesterId - 1;

  final previousSemesterCoursesQuery = db.select(
    db.semesterCourses,
  )..where((tbl) => tbl.semester.equals(previousSemesterId));

  final previousSemesterCourses = await previousSemesterCoursesQuery.get();

  await db
      .into(db.semesters)
      .insertOnConflictUpdate(Semester(id: currentSemesterId));
  await db.batch((batch) {
    for (final previousSemesterCourse in previousSemesterCourses) {
      batch.insert(
          db.semesterCourses,
          previousSemesterCourse.copyWith(
            semester: currentSemesterId,
          ));
    }
  });
}
