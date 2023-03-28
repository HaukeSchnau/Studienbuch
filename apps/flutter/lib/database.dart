import 'dart:io';
import 'package:class_companion/models/absence.dart';
import 'package:class_companion/models/class.dart';
import 'package:class_companion/models/course.dart';
import 'package:class_companion/models/course_time.dart';
import 'package:class_companion/models/grade_result.dart';
import 'package:path/path.dart' as p;
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path_provider/path_provider.dart';
import 'package:class_companion/models/semester.dart';

part 'database.g.dart';

@DriftDatabase(tables: [
  Teachers,
  Courses,
  CourseTimes,
  Absences,
  Classes,
  Semesters,
  SemesterCourses,
  GradeResults
])
class MyDatabase extends _$MyDatabase {
  // we tell the database where to store the data with this constructor
  MyDatabase() : super(_openConnection());

  // you should bump this number whenever you change or add a table definition.
  // Migrations are covered later in the documentation.
  @override
  int get schemaVersion => 1;

  @override
  MigrationStrategy get migration {
    return MigrationStrategy(beforeOpen: (details) async {
      await customStatement('PRAGMA foreign_keys = ON');
    });
  }
}

MyDatabase db = MyDatabase();

Future<File> get _dbFile async {
  final dbFolder = await getApplicationDocumentsDirectory();
  return File(p.join(dbFolder.path, 'db.sqlite'));
}

Future<void> resetDatabase() async {
  await db.close();

  final file = await _dbFile;
  await file.delete();

  db = MyDatabase();
}

LazyDatabase _openConnection() {
  // the LazyDatabase util lets us find the right location for the file async.
  return LazyDatabase(() async {
    // put the database file, called db.sqlite here, into the documents folder
    // for your app.
    final file = await _dbFile;

    return NativeDatabase.createInBackground(file);
  });
}
