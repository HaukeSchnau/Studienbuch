import 'package:class_mate/database.dart';
import 'package:class_mate/models/course.dart';
import 'package:drift/drift.dart';
import 'package:class_mate/lazy.dart';

enum SemesterType {
  winter,
  summer,
}

typedef SemesterId = int;

SemesterId getCurrentSemesterId() {
  final now = DateTime.now();
  int year = now.year;
  bool isWinter = now.month > 7 || now.month < 2;
  if (now.month < 2) {
    year--;
  }
  return year << 1 | (isWinter ? 1 : 0);
}

@UseRowClass(Semester)
class Semesters extends Table {
  IntColumn get id => integer()();

  @override
  Set<Column> get primaryKey => {id};
}

class Semester {
  final int id;
  final LazyList<Course> courses;

  Semester({
    required this.id,
  }) : courses = LazyList(() async {
          final semesterCoursesStatement = db.select(db.semesterCourses)
            ..where((sc) => sc.semester.equals(id));
          final semesterCourses = await semesterCoursesStatement.get();
          final coursesStatement = db.select(db.courses)
            ..where((c) => c.id.isIn(semesterCourses.map((sc) => sc.course)));
          return await coursesStatement.get();
        });

  String get name {
    final year = id >> 1;
    final isWinter = id & 1 == 1;
    if (isWinter) {
      return "Winter $year/${year + 1}";
    } else {
      return "Sommer ${year - 1}/$year";
    }
  }
}

class SemesterCourses extends Table {
  IntColumn get semester => integer().references(Semesters, #id)();
  IntColumn get course => integer().references(Courses, #id)();
}
