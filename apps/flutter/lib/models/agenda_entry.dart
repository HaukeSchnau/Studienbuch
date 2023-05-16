import 'package:class_mate/database.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/models/course_time.dart';
import 'package:class_mate/models/substitution.dart';
import 'package:class_mate/util/date_util.dart';

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

  factory AgendaEntry.empty(DateTime date, TimeOfDay lessonTime) {
    return AgendaEntry(
      course: null,
      concreteDate: date,
      recurringTime: CourseTime(
        id: -1,
        start: lessonTime,
        weekday: date.weekday,
        duration: 80,
      ),
    );
  }

  DateTime get start => _concreteDate;
  DateTime get end =>
      _concreteDate.add(Duration(minutes: recurringTime.duration));

  bool get isToday => _concreteDate.isToday;
  bool get isOver => DateTime.now().isAfter(end);
  bool get isNow =>
      DateTime.now().isAfter(start) && DateTime.now().isBefore(end);

  bool get isCancelled =>
      substitution?.type == SubstitutionType.entfall ||
      substitution?.type == SubstitutionType.freisetzung;
  bool get isSubstituted =>
      substitution?.type == SubstitutionType.vertretung ||
      substitution?.type == SubstitutionType.betreuung;

  int compareTo(AgendaEntry other) {
    return _concreteDate.compareTo(other._concreteDate);
  }
}
