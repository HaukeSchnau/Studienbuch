import 'package:class_mate/components/tasks/task_page.dart';
import 'package:class_mate/database/database.dart';
import 'package:class_mate/models/setup_store.dart';
import 'package:class_mate/pages/about_page.dart';
import 'package:class_mate/pages/absences_page.dart';
import 'package:class_mate/pages/course_page.dart';
import 'package:class_mate/pages/root_page.dart';
import 'package:class_mate/pages/setup/edit_profile_page.dart';
import 'package:class_mate/pages/setup/welcome_page.dart';
import 'package:drift/drift.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobx/mobx.dart';

buildMainRouterConfig(User? user) {
  return GoRouter(
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) {
          bool isLoggedIn = user != null;
          if (isLoggedIn) {
            return const RootPage();
          } else {
            return const WelcomePage();
          }
        },
      ),
      GoRoute(
        path: "/course/:courseId/:semesterId",
        builder: (context, state) {
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

          return FutureBuilder(
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
          );
        },
      ),
      GoRoute(
          path: "/tasks/:taskId",
          builder: (context, state) {
            return TaskPage(taskId: int.parse(state.params['taskId']!));
          }),
      GoRoute(
        path: "/absences",
        builder: (context, state) {
          return const AbsencesPage();
        },
      ),
      GoRoute(
        path: '/about',
        builder: (context, state) => const AboutPage(),
      ),
      GoRoute(
        path: '/editProfile',
        builder: (context, state) {
          if (user == null) {
            throw Exception("User is null");
          }

          return EditProfilePage(
            initialStore: SetupStore(
              courses: ObservableList(),
              licenseKey: user.licenseKey,
              licenseKeyActivatedAt: user.licenseKeyActivatedAt,
              name: user.name,
            ),
          );
        },
      ),
    ],
  );
}
