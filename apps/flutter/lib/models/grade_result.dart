import 'package:class_companion/models/course.dart';
import 'package:drift/drift.dart';

enum GradeResultType { written, oral, master }

class GradeResults extends Table {
  IntColumn get id => integer().autoIncrement()();
  DateTimeColumn get date => dateTime()();
  RealColumn get result => real()();
  IntColumn get course => integer().references(Courses, #id)(); 
  TextColumn get status => textEnum<GradeResultType>()();
}
