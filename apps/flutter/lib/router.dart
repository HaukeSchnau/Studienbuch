import 'package:class_mate/api/types.dart';
import 'package:class_mate/database/database.dart';
import 'package:class_mate/features/debug/debug_page.dart';
import 'package:class_mate/features/setup/edit_profile_page.dart';
import 'package:class_mate/features/setup/welcome_page.dart';
import 'package:class_mate/features/tasks/task_page.dart';
import 'package:class_mate/infrastructure/hooks/use_query.dart';
import 'package:class_mate/models/setup_store.dart';
import 'package:class_mate/features/about/about_page.dart';
import 'package:class_mate/features/absences/absences_page.dart';
import 'package:class_mate/features/courses/course_page.dart';
import 'package:class_mate/root_page.dart';
import 'package:drift/drift.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
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
          final courseId = int.parse(state.pathParameters['courseId']!);
          final semesterId = int.parse(state.pathParameters['semesterId']!);

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
            return TaskPage(taskId: int.parse(state.pathParameters['taskId']!));
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

          return EditProfileContainerPage(user: user);
        },
      ),
      GoRoute(
        path: '/debug',
        builder: (context, state) {
          return const DebugPage();
        },
      ),
    ],
  );
}

class EditProfileContainerPage extends HookWidget {
  final User user;

  const EditProfileContainerPage({super.key, required this.user});

  @override
  Widget build(BuildContext context) {
    final years = useQuery(
        () => db.select(db.years)..where((tbl) => tbl.id.equals(user.year)));

    if (years == null) {
      return const Center(
        child: CircularProgressIndicator(),
      );
    }

    final year = years.firstOrNull;
    print(year);

    return EditProfilePage(
        initialStore: SetupStore(
            courses: ObservableList(),
            licenseKey: user.licenseKey,
            licenseKeyActivatedAt: user.licenseKeyActivatedAt,
            name: user.name,
            isOfAge: user.isOfAge,
            year: year != null
                ? YearsGetOutput(
                    id: year.id,
                    name: year.name,
                    updatedAt: DateTime(0), // TODO: Fix this
                    startYear: year.startYear,
                    graduationYear: year.graduationYear,
                    schoolId: 1, // TODO: Fix this
                  )
                : null),
        onFinished: () => context.pop());
  }
}
