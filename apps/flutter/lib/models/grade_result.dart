import 'package:class_mate/database.dart';
import 'package:class_mate/models/course.dart';
import 'package:drift/drift.dart';

enum GradeResultType { written, oral, master }

class GradeResults extends Table {
  IntColumn get id => integer().autoIncrement()();
  DateTimeColumn get date => dateTime()();
  RealColumn get result => real()();
  IntColumn get course => integer().references(Courses, #id)();
  TextColumn get type => textEnum<GradeResultType>()();
  BoolColumn get isConfirmedByTeacher =>
      boolean().withDefault(const Constant(false))();
  BoolColumn get isConfirmedByParent =>
      boolean().withDefault(const Constant(false))();
}

extension GradeResultTypeExt on GradeResultType {
  String get name {
    switch (this) {
      case GradeResultType.written:
        return "Schriftlich";
      case GradeResultType.oral:
        return "Mündlich";
      case GradeResultType.master:
        return "Klausur";
    }
  }
}

extension GradeResultExt on GradeResult {
  bool get isConfirmed => isConfirmedByParent && isConfirmedByTeacher;
}

bool validateGradeString(String grade) {
  final parsed = double.tryParse(grade.replaceAll(",", "."));
  return parsed != null && parsed >= 0 && parsed <= 15;
}
