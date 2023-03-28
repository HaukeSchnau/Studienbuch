import 'package:class_companion/database.dart';
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

  bool get isSubstituted => substitution != null;
  bool get isCancelled => substitution?.type == SubstitutionType.cancelled;

  int compareTo(AgendaEntry other) {
    return _concreteDate.compareTo(other._concreteDate);
  }
}
