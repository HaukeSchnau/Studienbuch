import 'package:class_companion/models/course.dart';
import 'package:class_companion/models/course_time.dart';
import 'package:class_companion/models/substitution.dart';
import 'package:class_companion/util/date_util.dart';

class AgendaEntry {
  final Course? course;
  final DateTime _concreteDate;
  final CourseTime recurringTime;
  Substitution? substitution;

  AgendaEntry({
    required this.course,
    required DateTime concreteDate,
    required this.recurringTime,
    this.substitution,
  }) : _concreteDate = concreteDate.copyWith(
          hour: recurringTime.start.hour,
          minute: recurringTime.start.minute,
        );

  DateTime get start => _concreteDate;
  DateTime get end =>
      _concreteDate.add(Duration(minutes: recurringTime.duration));

  bool get isToday => _concreteDate.isToday;
  bool get isOver => DateTime.now().isAfter(end);
  bool get isNow =>
      DateTime.now().isAfter(start) && DateTime.now().isBefore(end);

  bool get isSubstituted => substitution != null;
  bool get isCancelled => substitution?.type == SubstitutionType.cancelled;

  int compareTo(AgendaEntry other) {
    return _concreteDate.compareTo(other._concreteDate);
  }

  Map<String, dynamic> toJson() {
    return {
      'course': course?.toJson(),
      'concreteDate': _concreteDate.toIso8601String(),
      'recurringTime': recurringTime.toJson(),
      'substitution': substitution?.toJson(),
    };
  }

  AgendaEntry.fromJson(Map<String, dynamic> json)
      : this(
          course: json["course"] != null
              ? Course.fromJson(json["course"])
              : null,
          concreteDate: DateTime.parse(json["concreteDate"]),
          recurringTime: CourseTime.fromJson(json["recurringTime"]),
          substitution: json["substitution"] != null
              ? Substitution.fromJson(json["substitution"])
              : null,
        );
}
