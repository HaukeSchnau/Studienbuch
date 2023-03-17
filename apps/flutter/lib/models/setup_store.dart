import 'package:class_companion/models/absence.dart';
import 'package:class_companion/models/class.dart';
import 'package:class_companion/models/course.dart';
import 'package:class_companion/models/course_time.dart';
import 'package:class_companion/models/store.dart';
import 'package:class_companion/models/user.dart';
import 'package:class_companion/models/year.dart';
import 'package:class_companion_api/api.dart';
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

  GlobalStore toGlobalStore() {
    final res = GlobalStore(
      licenseKey: licenseKey!,
      currentUser: User(
          isOfAge: isOfAge!,
          name: name!,
          absences: ObservableList<Absence>(),
          currentClass: Class(
              year: Year(
                id: year!.id,
                startYear: year!.startYear,
                graduationYear: year!.graduationYear,
                name: year!.name,
              ),
              identifierInYear: class_!.identifierInYear,
              id: class_!.id,
              courses: class_!.courses
                  .map((e) => Course(
                        id: e.id,
                        courseId: e.courseId,
                        name: e.name,
                        teacher: Teacher(
                          name: e.teacher.name,
                          title: e.teacher.title,
                        ),
                        courseTimes: e.times
                            .map((e) => CourseTime(
                                  duration: e.duration,
                                  weekday: e.weekday,
                                  start: TimeOfDay(
                                      hour: e.start ~/ 60,
                                      minute: e.start % 60),
                                ))
                            .toList()
                            .asObservable(),
                      ))
                  .toList()
                  .asObservable()),
          courses: courses
              .map((course) => Course(
                    id: course.id,
                    courseId: course.courseId,
                    name: course.name,
                    teacher: Teacher(
                      name: course.teacher.name,
                      title: course.teacher.title,
                    ),
                    courseTimes: course.times
                        .map((courseTime) => CourseTime(
                              duration: courseTime.duration,
                              weekday: courseTime.weekday,
                              start: TimeOfDay(
                                  hour: courseTime.start ~/ 60,
                                  minute: courseTime.start % 60),
                            ))
                        .toList()
                        .asObservable(),
                  ))
              .toList()
              .asObservable()),
    );

    return res;
  }
}
