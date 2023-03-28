import 'package:class_companion/database.dart';
import 'package:drift/drift.dart';
import 'package:class_companion/models/course.dart';

@UseRowClass(Absence, constructor: 'load')
class Absences extends Table {
  IntColumn get id => integer().autoIncrement()();
  DateTimeColumn get date => dateTime()();
  TextColumn get reason => text()();
  IntColumn get course => integer().nullable().references(Courses, #id)();
  BoolColumn get isExcusedByTeacher =>
      boolean().withDefault(const Constant(false))();
  BoolColumn get isExcusedByParent =>
      boolean().withDefault(const Constant(false))();
}

class Absence {
  final int id;
  final DateTime date;
  final String reason;
  final Course? course;
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
    required int? course,
    required bool isExcusedByTeacher,
    required bool isExcusedByParent,
  }) async {
    Course? concreteCourse;
    if (course != null) {
      final statement = db.select(db.courses)
        ..where(
          (dbCourse) => dbCourse.id.equals(course),
        );
      concreteCourse = await statement.getSingle();
    }
    return Absence(
      id: id,
      date: date,
      reason: reason,
      course: concreteCourse,
      isExcusedByTeacher: isExcusedByTeacher,
      isExcusedByParent: isExcusedByParent,
    );
  }

  bool get isExcused => isExcusedByTeacher || isExcusedByParent;
}
