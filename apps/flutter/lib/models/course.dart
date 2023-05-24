import 'dart:async';
import 'package:class_mate/database.dart';
import 'package:class_mate/hooks/use_query.dart';
import 'package:class_mate/models/class.dart';
import 'package:class_mate/models/semester.dart';
import 'package:drift/drift.dart';
import 'package:flutter/material.dart' hide Table;
import 'package:go_router/go_router.dart';

const _courseIconMap = {
  "Deutsch": "german.svg",
  "Englisch": "english.svg",
  "Mathe": "math.svg",
  "Physik": "physics.svg",
  "Chemie": "chemistry.svg",
  "Biologie": "bio.svg",
  "Informatik": "informatik-2.svg",
  "Geschichte": "history.svg",
  "Politik-Wirtschaft": "pw.svg",
  "Musik": "music.svg",
  "Sport": "sport.svg",
  "Kunst": "art.svg",
  "Religion": "religion.svg",
  "Französisch": "french.svg",
  "Spanisch": "spanish.svg",
  "Latein": "latin.svg",
  "Werte und Normen": "wun.svg",
  "Darstellendes Spiel": "ds.svg",
  "Seminarfach": "seminar.svg",
  "Sport-Theorie": "sport.svg",
};

String getCourseIcon(String courseName) {
  final icon = _courseIconMap[courseName];
  if (icon == null) {
    throw Exception("No icon for course $courseName");
  }
  return "assets/icons/$icon";
}

class Teachers extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get name => text()();
  TextColumn get title => text().nullable()();
}

@UseRowClass(Course, constructor: "load")
class Courses extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get courseId => text().nullable()();
  TextColumn get name => text()();
  IntColumn get teacher => integer().references(Teachers, #id)();
  IntColumn get parentClass => integer().nullable().references(Classes, #id)();
}

class Course {
  final int id;
  final String? courseId;
  final String name;
  final Teacher teacher;
  final Class? parentClass;
  final List<CourseTime> courseTimes;

  Course({
    required this.id,
    required this.courseId,
    required this.name,
    required this.teacher,
    required this.parentClass,
    required this.courseTimes,
  });

  static Future<Course> load({
    required int id,
    required String? courseId,
    required String name,
    required int teacher,
    required int? parentClass,
  }) async {
    final teacherQuery = db.select(db.teachers)
      ..where((t) => t.id.equals(teacher));
    final teach = await teacherQuery.getSingle();

    Class? class_;
    if (parentClass != null) {
      final classQuery = db.select(db.classes)
        ..where((t) => t.id.equals(parentClass));
      class_ = await classQuery.getSingle();
    }

    final courseTimesQuery = db.select(db.courseTimes)
      ..where((t) => t.course.equals(id));
    final courseTimes = await courseTimesQuery.get();

    return Course(
      id: id,
      courseId: courseId,
      name: name,
      teacher: teach,
      parentClass: class_,
      courseTimes: courseTimes,
    );
  }

  String get icon => getCourseIcon(name);

  void navigateTo(BuildContext context, SemesterId semester) {
    context.push("/course/$id/$semester");
  }
}

extension TeacherExtension on Teacher {
  String get formalName {
    String? title = this.title;

    if (title == null) {
      return name.split(" ").last;
    }

    if (title == "Herr") {
      return "Hr. ${name.split(" ").last}";
    }

    if (title == "Frau") {
      return "Fr. ${name.split(" ").last}";
    }

    return "$title ${name.split(" ").last}";
  }

  String get longFormalName {
    String? title = this.title;

    if (title == null) {
      return name;
    }

    return "$title ${name.split(" ").last}";
  }
}

List<Course> useCourses({int? semesterId}) {
  // final semesterCoursesStatement = db.select(db.semesterCourses)
  //   ..where((sc) => sc.semester.equals(id));
  // final semesterCourses = await semesterCoursesStatement.get();
  // final coursesStatement = db.select(db.courses)
  //   ..where((c) => c.id.isIn(semesterCourses.map((sc) => sc.course)));
  // return await coursesStatement.get();

  // Use joins to get the courses for the semester
  if (semesterId != null) {
    return useQueryJoin(() => db.select(db.courses).join([
              innerJoin(db.semesterCourses,
                  db.semesterCourses.course.equalsExp(db.courses.id)),
            ])
              ..where(db.semesterCourses.semester.equals(semesterId)))
        .map((row) => row.readTable(db.courses))
        .toList();
  }

  throw Exception("No semesterId provided");
}
