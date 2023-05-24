// ignore_for_file: unused_element

import 'package:class_mate/database.dart';
import 'package:class_mate/models/course_time.dart';
import 'package:class_mate/models/semester.dart';
import 'package:class_mate/models/store.dart';
import 'package:class_mate/models/user.dart';
import 'package:class_mate/models/year.dart';
import 'package:class_mate_api/api.dart';
import 'package:drift/drift.dart';
import 'package:mobx/mobx.dart';

part 'setup_store.g.dart';

class SetupStore = _SetupStoreBase with _$SetupStore;

const _weeksMap = {
  QueryClassesGet200ResponseInnerCoursesInnerTimesInnerWeeksEnum.BOTH:
      CourseTimeWeek.both,
  QueryClassesGet200ResponseInnerCoursesInnerTimesInnerWeeksEnum.EVEN:
      CourseTimeWeek.even,
  QueryClassesGet200ResponseInnerCoursesInnerTimesInnerWeeksEnum.ODD:
      CourseTimeWeek.odd,
};

extension YearExtension on ApiYear {
  int get yearNumber {
    final now = DateTime.now();
    final currentYear = now.year;

    if (now.month < 7) {
      return currentYear - startYear + 5 - 1;
    }

    return currentYear - startYear + 5;
  }
}

typedef ApiYear = QueryYearsGet200ResponseInner;
typedef ApiClass = QueryClassesGet200ResponseInner;
typedef ApiCourse = QueryCoursesGet200ResponseInner;

abstract class _SetupStoreBase with Store {
  @observable
  String? licenseKey;

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
    this.name,
    this.year,
    this.class_,
    this.isOfAge,
    required this.courses,
  });

  Future<void> saveToDatabase() async {
    await resetDatabase();

    await db.into(db.classes).insert(Class(
          id: class_!.id,
          identifierInYear: class_!.identifierInYear,
        ));

    for (final course in courses) {
      await db.into(db.teachers).insert(
          Teacher(
              id: course.teacher.id,
              name: course.teacher.name,
              title: course.teacher.title),
          mode: InsertMode.insertOrReplace);

      await db.into(db.courses).insert(CoursesCompanion.insert(
            id: Value(course.id),
            courseId: Value(
              course.courseId,
            ),
            name: course.name,
            teacher: course.teacher.id,
          ));

      for (final time in course.times) {
        await db.into(db.courseTimes).insert(CourseTime(
            id: time.id,
            duration: time.duration,
            start: TimeOfDay.fromMinutes(time.start),
            weekday: time.weekday,
            course: course.id,
            weeks: _weeksMap[time.weeks]!));
      }
    }

    for (final course
        in class_!.courses.where((element) => !element.isChoosable)) {
      await db.into(db.teachers).insert(
          Teacher(
              id: course.teacher.id,
              name: course.teacher.name,
              title: course.teacher.title),
          mode: InsertMode.insertOrReplace);

      await db.into(db.courses).insert(CoursesCompanion.insert(
            id: Value(course.id),
            courseId: Value(
              course.courseId,
            ),
            name: course.name,
            teacher: course.teacher.id,
            parentClass: Value(
              class_!.id,
            ),
          ));

      for (final time in course.times) {
        await db.into(db.courseTimes).insert(CourseTime(
              id: time.id,
              duration: time.duration,
              start: TimeOfDay.fromMinutes(time.start),
              weekday: time.weekday,
              course: course.id,
              weeks: _weeksMap[time.weeks]!,
            ));
      }
    }

    final currentSemesterId = getCurrentSemesterId();
    await db.into(db.semesters).insert(SemestersCompanion.insert(
          id: Value(currentSemesterId),
        ));

    for (final course in courses) {
      await db.into(db.semesterCourses).insert(SemesterCoursesCompanion.insert(
            semester: currentSemesterId,
            course: course.id,
          ));
    }

    for (final course
        in class_!.courses.where((element) => !element.isChoosable)) {
      await db.into(db.semesterCourses).insert(SemesterCoursesCompanion.insert(
            semester: currentSemesterId,
            course: course.id,
          ));
    }
  }

  GlobalStore toGlobalStore() {
    final res = GlobalStore(
      licenseKey: licenseKey!,
      user: User(
        isOfAge: isOfAge!,
        name: name!,
        year: Year(
          id: year!.id,
          startYear: year!.startYear,
          graduationYear: year!.graduationYear,
          name: year!.name,
        ),
      ),
    );

    return res;
  }
}
