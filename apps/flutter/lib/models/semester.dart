import 'package:class_mate/database.dart';
import 'package:class_mate/hooks/use_query.dart';
import 'package:class_mate/models/course.dart';
import 'package:drift/drift.dart';

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

class Semesters extends Table {
  IntColumn get id => integer()();

  @override
  Set<Column> get primaryKey => {id};
}

extension SemesterExt on Semester {
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

List<Semester> useSemesters() => useQuery(() => db.select(db.semesters));
