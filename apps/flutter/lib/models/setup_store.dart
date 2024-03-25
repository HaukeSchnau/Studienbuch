// ignore_for_file: unused_element

import 'package:class_mate/database/database.dart';
import 'package:class_mate/models/course_time.dart';
import 'package:class_mate/models/semester.dart';
import 'package:class_mate_api/api.dart';
import 'package:drift/drift.dart';
import 'package:mobx/mobx.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

part 'setup_store.g.dart';

class SetupStore = _SetupStoreBase with _$SetupStore;

const _weeksMap = {
  ClassesList200ResponseInnerCoursesInnerTimesInnerWeeksEnum.BOTH:
      CourseTimeWeek.both,
  ClassesList200ResponseInnerCoursesInnerTimesInnerWeeksEnum.EVEN:
      CourseTimeWeek.even,
  ClassesList200ResponseInnerCoursesInnerTimesInnerWeeksEnum.ODD:
      CourseTimeWeek.odd,
};

extension YearExtension on ApiYear {
  int get yearNumber {
    final now = DateTime.now();
    final currentYear = now.year;

    if (now.month < 8) {
      return currentYear - startYear + 5 - 1;
    }

    return currentYear - startYear + 5;
  }
}

typedef ApiYear = YearsGet200ResponseInner;
typedef ApiClass = ClassesList200ResponseInner;
typedef ApiCourse = CoursesList200ResponseInner;

abstract class _SetupStoreBase with Store {
  @observable
  String? licenseKey;

  @observable
  DateTime? licenseKeyActivatedAt;

  @observable
  String? name;

  @observable
  ApiYear? year;

  @observable
  ApiClass? class_;

  @observable
  bool? isOfAge;

  @observable
  ObservableList<ApiCourse> courses = ObservableList<ApiCourse>();

  _SetupStoreBase({
    this.licenseKey,
    this.licenseKeyActivatedAt,
    this.name,
    this.year,
    this.class_,
    this.isOfAge,
    required this.courses,
  });

  Future<void> saveToDatabase() async {
    await saveUserData(
      year: Year(
        id: year!.id,
        startYear: year!.startYear,
        graduationYear: year!.graduationYear,
        name: year!.name,
      ),
      licenseKey: licenseKey!,
      licenseKeyActivatedAt: licenseKeyActivatedAt!,
      name: name!,
      isOfAge: isOfAge!,
    );

    await saveSemesterData(
        class_: class_!, courses: courses, semesterId: getCurrentSemesterId());
  }
}

Future<void> saveSemesterData({
  required ApiClass class_,
  required List<ApiCourse> courses,
  required SemesterId semesterId,
}) async {
  await (db.delete(db.semesterCourses)
        ..where((tbl) => tbl.semester.equals(semesterId)))
      .go();

  await db.into(db.classes).insert(
      Class(
        id: class_.id,
        identifierInYear: class_.identifierInYear,
      ),
      mode: InsertMode.insertOrReplace);

  for (final course in courses) {
    await db.into(db.teachers).insert(
        Teacher(
            id: course.teacher.id,
            name: course.teacher.name,
            title: course.teacher.title),
        mode: InsertMode.insertOrReplace);

    await db.into(db.courses).insert(
        CoursesCompanion.insert(
          id: Value(course.id),
          courseId: Value(
            course.courseId,
          ),
          name: course.name,
          teacher: course.teacher.id,
        ),
        mode: InsertMode.insertOrReplace);

    for (final time in course.times) {
      await db.into(db.courseTimes).insert(
          CourseTime(
              id: time.id,
              duration: time.duration,
              start: TimeOfDay.fromMinutes(time.start),
              weekday: time.weekday,
              course: course.id,
              weeks: _weeksMap[time.weeks]!),
          mode: InsertMode.insertOrReplace);
    }
  }

  for (final course
      in class_.courses.where((element) => !element.isChoosable)) {
    await db.into(db.teachers).insert(
        Teacher(
            id: course.teacher.id,
            name: course.teacher.name,
            title: course.teacher.title),
        mode: InsertMode.insertOrReplace);

    await db.into(db.courses).insert(
        CoursesCompanion.insert(
          id: Value(course.id),
          courseId: Value(
            course.courseId,
          ),
          name: course.name,
          teacher: course.teacher.id,
          parentClass: Value(
            class_.id,
          ),
        ),
        mode: InsertMode.insertOrReplace);

    for (final time in course.times) {
      await db.into(db.courseTimes).insert(
          CourseTime(
            id: time.id,
            duration: time.duration,
            start: TimeOfDay.fromMinutes(time.start),
            weekday: time.weekday,
            course: course.id,
            weeks: _weeksMap[time.weeks]!,
          ),
          mode: InsertMode.insertOrReplace);
    }
  }

  await db.into(db.semesters).insert(
      SemestersCompanion.insert(
        id: Value(semesterId),
      ),
      mode: InsertMode.insertOrReplace);

  for (final course in courses) {
    await db.into(db.semesterCourses).insert(SemesterCoursesCompanion.insert(
          semester: semesterId,
          course: course.id,
        ));
  }

  for (final course
      in class_.courses.where((element) => !element.isChoosable)) {
    await db.into(db.semesterCourses).insert(SemesterCoursesCompanion.insert(
          semester: semesterId,
          course: course.id,
        ));
  }

  await Sentry.captureMessage("Saved semester data for semester $semesterId");
}

Future<void> saveUserData({
  required Year year,
  required String licenseKey,
  required DateTime licenseKeyActivatedAt,
  required String name,
  required bool isOfAge,
}) async {
  await db.into(db.years).insertOnConflictUpdate(
        YearsCompanion.insert(
          id: Value(year.id),
          startYear: year.startYear,
          graduationYear: year.graduationYear,
          name: year.name,
        ),
      );

  await db.into(db.users).insertOnConflictUpdate(
        UsersCompanion.insert(
          id: const Value(0),
          // We want to have only one user in the database
          licenseKey: licenseKey,
          licenseKeyActivatedAt: licenseKeyActivatedAt,
          name: name,
          isOfAge: isOfAge,
          year: year.id,
        ),
      );

  await Sentry.captureMessage(
      "Saved user: $name with license key $licenseKey in year ${year.name}");
}
