import 'dart:io';

import 'package:class_mate/database/schema_versions.dart';
import 'package:class_mate/models/absence.dart';
import 'package:class_mate/models/class.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/models/course_time.dart';
import 'package:class_mate/models/grade_result.dart';
import 'package:class_mate/models/semester.dart';
import 'package:class_mate/models/task.dart';
import 'package:class_mate/models/user.dart';
import 'package:class_mate/models/year.dart';
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sentry/sentry.dart';

part 'database.g.dart';

@DriftDatabase(tables: [
  Teachers,
  Courses,
  CourseTimes,
  Absences,
  Classes,
  Semesters,
  SemesterCourses,
  GradeResults,
  Tasks,
  Users,
  Years
])
class MyDatabase extends _$MyDatabase {
  MyDatabase() : super(_openConnection());

  @override
  int get schemaVersion => 4;

  @override
  MigrationStrategy get migration {
    return MigrationStrategy(
      beforeOpen: (details) async {
        await customStatement('PRAGMA foreign_keys = ON');
      },
      onCreate: (Migrator m) async {
        await m.createAll();
      },
      onUpgrade: stepByStep(
        from1To2: (m, schema) async {
          await m.createTable(schema.users);
          await m.createTable(schema.years);
        },
        from2To3: (m, schema) async {
          await m.addColumn(schema.users, schema.users.lastSyncedAt);
          await m.addColumn(schema.users, schema.users.lastFullSyncedAt);
        },
        from3To4: (m, schema) async {
          await m.addColumn(
              schema.users, schema.users.hasCompletedScheduleTutorial);
        },
      ),
    );
  }
}

MyDatabase db = MyDatabase();

Future<String> getDbFilePath() async {
  final dbFolder = await getApplicationDocumentsDirectory();
  return p.join(dbFolder.path, 'database.sqlite');
}

Future<File> getDbFile() async {
  return File(await getDbFilePath());
}

Future<void> resetDatabase() async {
  await db.close();

  final file = await getDbFile();
  if (await file.exists()) await file.delete();

  db = MyDatabase();
}

LazyDatabase _openConnection() {
  // the LazyDatabase util lets us find the right location for the file async.
  return LazyDatabase(() async {
    final file = await getDbFile();

    if ((await file.exists()) && (await file.stat()).size == 0) {
      Sentry.captureMessage("Database file is empty");
    }

    return NativeDatabase.createInBackground(file);
  });
}
