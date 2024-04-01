import 'package:class_mate/api/types.dart';
import 'package:class_mate/database/database.dart';
import 'package:class_mate/business_domain/user/use_user.dart';
import 'package:class_mate/infrastructure/api.dart';
import 'package:class_mate/models/course_time.dart';
import 'package:drift/drift.dart';
import 'package:sentry/sentry.dart';

Future<void> syncTimetableData() async {
  final user = getOptionalUser();
  if (user == null) {
    return;
  }

  final lastSyncedAt = user.lastSyncedAt;
  final lastFullSyncedAt = user.lastFullSyncedAt;

  bool shouldSyncLite = lastSyncedAt != null &&
      lastSyncedAt.difference(DateTime.now()).inDays.abs() > 1;

  bool shouldSyncFull = lastSyncedAt == null ||
      lastFullSyncedAt == null ||
      lastFullSyncedAt.difference(DateTime.now()).inDays.abs() > 7;

  if (shouldSyncFull) {
    Sentry.captureMessage("Syncing full!");

    final syncResult = await getSyncResult(null);
    await applySyncResult(syncResult);

    await db.update(db.users).write(UsersCompanion(
        lastSyncedAt: Value(DateTime.now()),
        lastFullSyncedAt: Value(DateTime.now())));
  } else if (shouldSyncLite) {
    Sentry.captureMessage("Syncing Lite!");

    final syncResult = await getSyncResult(lastSyncedAt);
    await applySyncResult(syncResult);

    await db
        .update(db.users)
        .write(UsersCompanion(lastSyncedAt: Value(DateTime.now())));
  }
}

Future<SyncOutput?> getSyncResult(DateTime? lastSync) async {
  final [courseIds, classIds, yearIds, teacherIds] = await getRelevantIds();

  return api.sync(
      courseIds: courseIds,
      classIds: classIds,
      yearIds: yearIds,
      userIds: teacherIds,
      lastSync: lastSync);
}

Future<List<List<int>>> getRelevantIds() {
  return Future.wait([
    (db.select(db.courses)..where((tbl) => tbl.isManuallyEdited.equals(false)))
        .get()
        .then((value) => value.map((e) => e.id).toList()),
    db
        .select(db.classes)
        .get()
        .then((value) => value.map((e) => e.id).toList()),
    db.select(db.years).get().then((value) => value.map((e) => e.id).toList()),
    db
        .select(db.teachers)
        .get()
        .then((value) => value.map((e) => e.id).toList()),
  ]);
}

Future<void> applySyncResult(SyncOutput? syncResult) async {
  if (syncResult == null) {
    Sentry.captureException(Exception("Sync result was null!"));
    return;
  }

  await db.transaction(() async {
    for (final teacher in syncResult.updatedUsers) {
      await db.into(db.teachers).insert(
            Teacher(id: teacher.id, name: teacher.name, title: teacher.title),
            mode: InsertMode.insertOrReplace,
          );
    }
  });

  await db.transaction(() async {
    for (final updatedClass in syncResult.updatedClasses) {
      await db.into(db.classes).insert(
            Class(
                id: updatedClass.id,
                identifierInYear: updatedClass.identifierInYear),
            mode: InsertMode.insertOrReplace,
          );
    }
  });

  await db.transaction(() async {
    for (final course in syncResult.updatedCourses) {
      await db.into(db.courses).insert(
            CoursesCompanion(
              id: Value(course.id),
              name: Value(course.name),
              teacher: Value(course.teacherId),
              parentClass: Value(course.classId),
              courseId: Value(course.courseId),
            ),
            mode: InsertMode.insertOrReplace,
          );
    }
  });

  final returnedCourseIds = syncResult.updatedCourses.map((e) => e.id).toList();
  await (db.delete(db.courseTimes)
        ..where((tbl) => tbl.course.isIn(returnedCourseIds)))
      .go();

  await db.transaction(() async {
    for (final courseTime in syncResult.updatedCourseTimes) {
      await db.into(db.courseTimes).insert(
            CourseTime(
              id: courseTime.id,
              duration: courseTime.duration as int,
              start: TimeOfDay.fromMinutes(courseTime.start as int),
              weekday: courseTime.weekday as int,
              course: courseTime.courseId,
              weeks: _weeksMap[courseTime.weeks]!,
            ),
            mode: InsertMode.insertOrReplace,
          );
    }
  });
}

const _weeksMap = {
  SyncOutputUpdatedCourseTimesWeeksEnum.both: CourseTimeWeek.both,
  SyncOutputUpdatedCourseTimesWeeksEnum.even: CourseTimeWeek.even,
  SyncOutputUpdatedCourseTimesWeeksEnum.odd: CourseTimeWeek.odd,
};
