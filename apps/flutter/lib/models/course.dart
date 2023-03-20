import 'package:class_companion/models/course_time.dart';
import 'package:class_companion/static/years.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobx/mobx.dart';
part 'course.g.dart';

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
};

String getCourseIcon(String courseName) {
  final icon = _courseIconMap[courseName];
  if (icon == null) {
    throw Exception("No icon for course $courseName");
  }
  return "assets/icons/$icon";
}

class Course = _CourseBase with _$Course;

abstract class _CourseBase with Store {
  @observable
  int id;

  @observable
  String? courseId;

  @observable
  String name;

  @observable
  Teacher teacher;

  @observable
  List<CourseTime> courseTimes;

  _CourseBase({
    required this.id,
    required this.courseId,
    required this.name,
    required this.teacher,
    required this.courseTimes,
  });

  void navigateTo(BuildContext context, Semester semester) {
    context.push("/course", extra: this);
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'courseId': courseId,
      'name': name,
      'teacher': teacher.toJson(),
      'courseTimes': courseTimes.map((e) => e.toJson()).toList(),
    };
  }

  _CourseBase.fromJson(Map<String, dynamic> json)
      : this(
          id: json["id"],
          courseId: json["courseId"],
          name: json["name"],
          teacher: Teacher.fromJson(json["teacher"]),
          courseTimes: (json["courseTimes"] as List)
              .map<CourseTime>((e) => CourseTime.fromJson(e))
              .toList(),
        );

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is _CourseBase &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;
}

class Teacher {
  final String name;
  final String? title;

  Teacher({required this.name, required this.title});

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

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'title': title,
    };
  }

  Teacher.fromJson(Map<String, dynamic> json)
      : this(
          name: json["name"],
          title: json["title"],
        );
}
