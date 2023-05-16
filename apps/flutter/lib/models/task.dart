import 'package:class_mate/models/course.dart';
import 'package:drift/drift.dart';

class Tasks extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get title => text()();
  TextColumn get description => text()();
  DateTimeColumn get dueDate => dateTime()();
  IntColumn get course => integer().references(Courses, #id)();
  TextColumn get images => text().withDefault(const Constant(""))();
  BoolColumn get done => boolean().withDefault(const Constant(false))();
}
