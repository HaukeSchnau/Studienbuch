import 'dart:async';

import 'package:class_mate/database/database.dart';
import 'package:class_mate/hooks/use_query.dart';
import 'package:class_mate/models/class.dart';
import 'package:class_mate/models/semester.dart';
import 'package:drift/drift.dart';
import 'package:flutter/material.dart' hide Table;
import 'package:flutter_hooks/flutter_hooks.dart';
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

String? getCourseIcon(String courseName) {
  final icon = _courseIconMap[courseName];
  if (icon == null) {
    return null;
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

class Course extends ChangeNotifier {
  final int id;
  final String? courseId;
  final String name;
  Teacher teacher;
  final Class? parentClass;
  List<CourseTime> courseTimes;

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

    final ret = Course(
      id: id,
      courseId: courseId,
      name: name,
      teacher: teach,
      parentClass: class_,
      courseTimes: courseTimes,
    );

    teacherQuery.watch().listen((event) {
      ret.teacher = event.single;
      ret.notifyListeners();
    });

    courseTimesQuery.watch().listen((event) {
      ret.courseTimes = event;
      ret.notifyListeners();
    });

    return ret;
  }

  String? get icon => getCourseIcon(name);

  String get abbrv => _nameAbbrvMap[name.toLowerCase()]?.toUpperCase() ?? name;

  void navigateTo(BuildContext context, SemesterId semester) {
    context.push("/course/$id/$semester");
  }
}

final _nameAbbrvMap = {
  "deutsch": "de",
  "englisch": "en",
  "mathe": "ma",
  "physik": "ph",
  "chemie": "ch",
  "biologie": "bi",
  "informatik": "inf",
  "geschichte": "ge",
  "politik-wirtschaft": "pw",
  "musik": "mu",
  "sport": "sp",
  "kunst": "ku",
  "religion": "re",
  "französisch": "fr",
  "spanisch": "sp",
  "latein": "la",
  "werte und normen": "wun",
  "darstellendes spiel": "ds",
  "seminarfach": "sf",
};

extension TeacherExtension on Teacher {
  String get lastName => name.split(" ").last;

  String get formalName {
    String? title = this.title;

    if (title == null) {
      return lastName;
    }

    if (title == "Herr") {
      return "Hr. $lastName";
    }

    if (title == "Frau") {
      return "Fr. $lastName";
    }

    return "$title $lastName";
  }

  String get longFormalName {
    String? title = this.title;

    if (title == null) {
      return name;
    }

    return "$title $lastName";
  }
}

JoinedSelectStatement<HasResultSet, dynamic> createSemesterCoursesQuery(
    {int? semesterId}) {
  return db.select(db.semesterCourses).join(
    [
      innerJoin(db.courses, db.semesterCourses.course.equalsExp(db.courses.id)),
    ],
  )..where(
      db.semesterCourses.semester.equals(semesterId ?? getCurrentSemesterId()));
}

/// Returns a list of all courses
/// If [semesterId] is specified, only courses of that semester are returned. Otherwise, the current semester is used.
List<Course>? useCourses({int? semesterId}) {
  final querySnapshot = useQueryJoin(
      () => createSemesterCoursesQuery(semesterId: semesterId), []);

  final courses = useMemoized(
      () => querySnapshot?.map((row) => row.readTable(db.courses)).toList(),
      [querySnapshot]);

  return courses;
}
