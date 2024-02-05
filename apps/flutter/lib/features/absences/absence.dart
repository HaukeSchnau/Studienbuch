import 'package:class_mate/database/database.dart';
import 'package:class_mate/infrastructure/hooks/use_query.dart';
import 'package:class_mate/models/course.dart';
import 'package:drift/drift.dart';

@UseRowClass(Absence, constructor: 'load')
class Absences extends Table {
  IntColumn get id => integer().autoIncrement()();

  DateTimeColumn get date => dateTime()();

  TextColumn get reason => text()();

  IntColumn get course => integer().references(Courses, #id)();

  BoolColumn get isExcusedByTeacher =>
      boolean().withDefault(const Constant(false))();

  BoolColumn get isExcusedByParent =>
      boolean().withDefault(const Constant(false))();
}

class Absence {
  final int id;
  final DateTime date;
  final String reason;
  Course course;
  final bool isExcusedByTeacher;
  final bool isExcusedByParent;

  Absence({
    required this.id,
    required this.date,
    required this.reason,
    required this.course,
    required this.isExcusedByTeacher,
    required this.isExcusedByParent,
  });

  static Future<Absence> load({
    required int id,
    required DateTime date,
    required String reason,
    required int course,
    required bool isExcusedByTeacher,
    required bool isExcusedByParent,
  }) async {
    Course? concreteCourse;
    final statement = db.select(db.courses)
      ..where(
        (dbCourse) => dbCourse.id.equals(course),
      );
    concreteCourse = await statement.getSingle();
    final ret = Absence(
      id: id,
      date: date,
      reason: reason,
      course: concreteCourse,
      isExcusedByTeacher: isExcusedByTeacher,
      isExcusedByParent: isExcusedByParent,
    );

    statement.watch().listen((event) {
      ret.course = event.single;
    });

    return ret;
  }

  bool get isExcused => isExcusedByTeacher && isExcusedByParent;
}

class AbsenceGroup {
  final List<Absence> children;
  final DateTime date;
  final String reason;
  final bool isExcusedByTeacher;
  final bool isExcusedByParent;

  AbsenceGroup({
    required this.children,
    required this.date,
    required this.reason,
    required this.isExcusedByTeacher,
    required this.isExcusedByParent,
  });

  bool get isExcused => isExcusedByTeacher && isExcusedByParent;
}

AbsenceGroup mapAbsenceToGroup(Absence absence) {
  return AbsenceGroup(
    children: [absence],
    date: absence.date,
    reason: absence.reason,
    isExcusedByTeacher: absence.isExcusedByTeacher,
    isExcusedByParent: absence.isExcusedByParent,
  );
}

List<Absence>? useAbsences() => useQuery(() => db.select(db.absences));

List<Absence>? useUnexcusedAbsences() => useQuery(() => db.select(db.absences)
  ..where((tbl) =>
      tbl.isExcusedByParent.equals(false) |
      tbl.isExcusedByTeacher.equals(false)));

List<Absence>? useExcusedAbsences() => useQuery(() => db.select(db.absences)
  ..where((tbl) =>
      tbl.isExcusedByParent.equals(true) &
      tbl.isExcusedByTeacher.equals(true)));
