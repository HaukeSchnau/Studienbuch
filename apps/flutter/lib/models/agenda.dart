import 'package:class_mate/models/agenda_entry.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/models/course_time.dart';
import 'package:class_mate/util/date_util.dart';
import 'package:mobx/mobx.dart';
part 'agenda.g.dart';

const lessonTimes = [
  TimeOfDay(hour: 8, minute: 0),
  TimeOfDay(hour: 9, minute: 45),
  TimeOfDay(hour: 11, minute: 30),
  TimeOfDay(hour: 13, minute: 50),
  TimeOfDay(hour: 15, minute: 15),
];

class Agenda = _AgendaBase with _$Agenda;

abstract class _AgendaBase with Store {
  DateTime date;
  List<AgendaEntry> entries = [];

  _AgendaBase({
    required DateTime start,
    required List<Course> courses,
    bool autoAdjust = true,
  }) : date = start {
    start = start.startOfDay;

    final entries = _buildEntries(courses, start);
    final entriesAhead = entries.where((element) => !element.isOver);

    if (entriesAhead.isEmpty && autoAdjust) {
      DateTime nextDate;
      if (start.weekday == DateTime.friday) {
        nextDate = start.add(const Duration(days: 3));
      } else if (start.weekday == DateTime.saturday) {
        nextDate = start.add(const Duration(days: 2));
      } else {
        nextDate = start.add(const Duration(days: 1));
      }

      date = nextDate;
      this.entries = _buildEntries(courses, nextDate);
    } else {
      date = start;
      this.entries = entries;
    }
    this.entries.sort((a, b) => a.start.compareTo(b.start));

    if (this.entries.isEmpty) {
      return;
    }

    // Fill in empty slots, but not after the last entry of the day (which is the last entry of the list) or before the first lesson time of the day
    // TODO make this more efficient
    final lastEntry = this.entries.last;
    for (final time in lessonTimes) {
      if (time.isBefore(lastEntry.recurringTime.start) &&
          !this.entries.any((element) => element.recurringTime.start == time)) {
        final entry = AgendaEntry.empty(date, time);
        this.entries.add(entry);
      }
    }
    this.entries.sort((a, b) => a.start.compareTo(b.start));
  }

  bool get isToday {
    final now = DateTime.now().startOfDay;

    return now == date;
  }

  String get when {
    final now = DateTime.now().startOfDay;

    final isToday = now == date;
    final isTomorrow = now.add(const Duration(days: 1)) == date;

    if (isToday) {
      return "heute";
    } else if (isTomorrow) {
      return "morgen";
    } else if (date.weekday == DateTime.monday) {
      return "am Montag";
    } else {
      return "am ${date.day}.${date.month}.";
    }
  }
}

List<AgendaEntry> _buildEntries(List<Course> courses, DateTime date) {
  date = date.startOfDay;

  List<AgendaEntry> entries = [];
  for (final course in courses) {
    for (final time in course.courseTimes) {
      if (time.weekday == date.weekday) {
        // final substitution = substitutions.firstWhereOrNull((sub) =>
        //     sub.agendaEntry.start ==
        //     date.copyWith(hour: time.start.hour, minute: time.start.minute));

        entries.add(AgendaEntry(
          course: course,
          recurringTime: time,
          concreteDate: date,
        ));
      }
    }
  }

  return entries;
}
