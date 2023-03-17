import 'package:class_companion/models/course.dart';
import 'package:mobx/mobx.dart';
part 'absence.g.dart';

class Absence = _AbsenceBase with _$Absence;

abstract class _AbsenceBase with Store {
  @observable
  DateTime date;

  @observable
  String reason;

  @observable
  Course course;

  @observable
  bool isExcusedByTeacher;

  @observable
  bool isExcusedByParent;

  _AbsenceBase({
    required this.date,
    required this.reason,
    required this.course,
    this.isExcusedByTeacher = false,
    this.isExcusedByParent = false,
  });

  Map<String, dynamic> toJson() {
    return {
      'date': date.toIso8601String(),
      'reason': reason,
      'course': course.toJson(),
      'isExcusedByTeacher': isExcusedByTeacher,
      'isExcusedByParent': isExcusedByParent,
    };
  }

  _AbsenceBase.fromJson(Map<String, dynamic> json)
      : this(
          date: DateTime.parse(json['date']),
          reason: json['reason'],
          course: Course.fromJson(json['course']),
          isExcusedByTeacher: json['isExcusedByTeacher'],
          isExcusedByParent: json['isExcusedByParent'],
        );
}
