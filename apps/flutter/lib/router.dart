import 'package:class_mate/components/tasks/task_page.dart';
import 'package:class_mate/database.dart';
import 'package:class_mate/models/store.dart';
import 'package:class_mate/pages/about_page.dart';
import 'package:class_mate/pages/absences_page.dart';
import 'package:class_mate/pages/course_page.dart';
import 'package:class_mate/pages/root_page.dart';
import 'package:class_mate/pages/welcome_page.dart';
import 'package:drift/drift.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

typedef UpdateStoreCallback = void Function(GlobalStore newStore);

buildMainRouter(
    ValueNotifier<GlobalStore?> store, UpdateStoreCallback updateStore) {
  return GoRouter(
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) {
          final val = store.value;
          if (val != null) {
            return Provider(
              create: (_) => val,
              child: const RootPage(),
            );
          } else {
            return Provider(
              create: (_) => updateStore,
              child: const WelcomePage(),
            );
          }
        },
      ),
      GoRoute(
        path: "/course/:courseId/:semesterId",
        builder: (context, state) {
          final val = store.value;
          if (val != null) {
            final courseId = int.parse(state.params['courseId']!);
            final semesterId = int.parse(state.params['semesterId']!);

            final semesterCourseFuture = (db.select(db.semesterCourses)
                  ..where((tbl) =>
                      tbl.semester.equals(semesterId) &
                      tbl.course.equals(courseId)))
                .join(
              [
                innerJoin(db.courses,
                    db.courses.id.equalsExp(db.semesterCourses.course)),
                innerJoin(db.semesters,
                    db.semesters.id.equalsExp(db.semesterCourses.semester)),
              ],
            ).getSingle();

            return Provider(
              create: (_) => val,
              child: FutureBuilder(
                future: semesterCourseFuture,
                builder: (context, snapshot) {
                  if (snapshot.hasData) {
                    final semesterCourse = snapshot.data;
                    if (semesterCourse == null) {
                      return const Center(child: Text("Kurs nicht gefunden"));
                    }
                    final course = semesterCourse.readTable(db.courses);
                    final semester = semesterCourse.readTable(db.semesters);

                    return CoursePage(
                      course: course,
                      semester: semester,
                    );
                  } else {
                    return const Center(
                      child: CircularProgressIndicator(),
                    );
                  }
                },
              ),
            );
          } else {
            return Provider(
              create: (_) => updateStore,
              child: const WelcomePage(),
            );
          }
        },
      ),
      GoRoute(
          path: "/tasks/:taskId",
          builder: (context, state) {
            final val = store.value;
            if (val != null) {
              return Provider(
                create: (_) => val,
                child: TaskPage(taskId: int.parse(state.params['taskId']!)),
              );
            } else {
              return Provider(
                create: (_) => updateStore,
                child: const WelcomePage(),
              );
            }
          }),
      GoRoute(
        path: "/absences",
        builder: (context, state) {
          final val = store.value;
          if (val != null) {
            return Provider(
              create: (_) => val,
              child: const AbsencesPage(),
            );
          } else {
            return Provider(
              create: (_) => updateStore,
              child: const WelcomePage(),
            );
          }
        },
      ),
      GoRoute(
        path: '/about',
        builder: (context, state) => const AboutPage(),
      ),
      GoRoute(
          path: "/setup",
          builder: (context, state) => Provider(
                create: (_) => updateStore,
                child: const WelcomePage(),
              )),
    ],
  );
}
