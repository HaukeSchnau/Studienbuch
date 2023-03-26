import 'package:class_companion/database.dart';
import 'package:class_companion/models/course_time.dart';
import 'package:class_companion/models/semester.dart';
import 'package:class_companion/models/store.dart';
import 'package:class_companion/models/user.dart';
import 'package:class_companion/models/year.dart';
import 'package:class_companion_api/api.dart';
import 'package:drift/drift.dart';
import 'package:mobx/mobx.dart';

part 'setup_store.g.dart';

class SetupStore = _SetupStoreBase with _$SetupStore;

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

  Future<void> saveToDatabase() async {
    await resetDatabase();

    await database.into(database.classes).insert(Class(
          id: class_!.id,
          identifierInYear: class_!.identifierInYear,
        ));

    for (final course in courses) {
      await database.into(database.teachers).insert(
          Teacher(
              id: course.teacher.id,
              name: course.teacher.name,
              title: course.teacher.title),
          mode: InsertMode.insertOrReplace);

      await database.into(database.courses).insert(CoursesCompanion.insert(
            id: Value(course.id),
            courseId: Value(
              course.courseId,
            ),
            name: course.name,
            teacher: course.teacher.id,
          ));

      for (final time in course.times) {
        await database.into(database.courseTimes).insert(CourseTime(
              id: time.id,
              duration: time.duration,
              start: TimeOfDay.fromMinutes(time.start),
              weekday: time.weekday,
              course: course.id,
            ));
      }
    }

    for (final course in class_!.courses) {
      await database.into(database.teachers).insert(
          Teacher(
              id: course.teacher.id,
              name: course.teacher.name,
              title: course.teacher.title),
          mode: InsertMode.insertOrReplace);

      await database.into(database.courses).insert(CoursesCompanion.insert(
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
        await database.into(database.courseTimes).insert(CourseTime(
              id: time.id,
              duration: time.duration,
              start: TimeOfDay.fromMinutes(time.start),
              weekday: time.weekday,
              course: course.id,
            ));
      }
    }

    final currentSemesterId = getCurrentSemesterId();
    await database.into(database.semesters).insert(SemestersCompanion.insert(
          id: Value(currentSemesterId),
        ));

    for (final course in courses) {
      await database
          .into(database.semesterCourses)
          .insert(SemesterCoursesCompanion.insert(
            semester: currentSemesterId,
            course: course.id,
          ));
    }

    for (final course in class_!.courses) {
      await database
          .into(database.semesterCourses)
          .insert(SemesterCoursesCompanion.insert(
            semester: currentSemesterId,
            course: course.id,
          ));
    }
  }

  GlobalStore toGlobalStore() {
    final res = GlobalStore(
      licenseKey: licenseKey!,
      currentUser: User(
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
