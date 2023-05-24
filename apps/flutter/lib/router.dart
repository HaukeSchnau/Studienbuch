import 'package:class_mate/components/tasks/task_page.dart';
import 'package:class_mate/database.dart';
import 'package:class_mate/models/semester.dart';
import 'package:class_mate/models/store.dart';
import 'package:class_mate/pages/about_page.dart';
import 'package:class_mate/pages/absences_page.dart';
import 'package:class_mate/pages/course_page.dart';
import 'package:class_mate/pages/root_page.dart';
import 'package:class_mate/pages/welcome_page.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:class_mate/models/course.dart';

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
            final futures = Future.wait([
              (db.select(db.courses)
                    ..where((tbl) =>
                        tbl.id.equals(int.parse(state.params['courseId']!))))
                  .getSingleOrNull(),
              (db.select(db.semesters)
                    ..where((tbl) =>
                        tbl.id.equals(int.parse(state.params['semesterId']!))))
                  .getSingleOrNull(),
            ]);
            return Provider(
              create: (_) => val,
              child: FutureBuilder(
                future: futures,
                builder: (context, snapshot) {
                  if (snapshot.hasData) {
                    return Provider(
                      create: (_) => snapshot.data as Course,
                      child: CoursePage(
                        course: snapshot.data![0] as Course,
                        semester: snapshot.data![1] as Semester,
                      ),
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
