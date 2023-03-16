import 'package:class_companion/models/course_time.dart';
import 'package:mobx/mobx.dart';
part 'course.g.dart';

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
