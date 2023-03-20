import 'package:class_companion/models/agenda_entry.dart';
import 'package:class_companion/models/course.dart';
import 'package:class_companion/util/date_util.dart';

import 'package:mobx/mobx.dart';
part 'agenda.g.dart';

class Agenda = _AgendaBase with _$Agenda;

abstract class _AgendaBase with Store {
  DateTime date;
  List<AgendaEntry> entries = [];

  _AgendaBase(
      {required DateTime start,
      required List<Course> courses,
      bool autoAdjust = true})
      : date = start {
    start = start.startOfDay;

    final entries = _buildEntries(courses, start);
    final entriesAhead = entries.where((element) => !element.isOver);

    if (entriesAhead.isEmpty && autoAdjust) {
      final nextDate = start.weekday == DateTime.friday
          ? start.add(const Duration(days: 3))
          : start.add(const Duration(days: 1));
      date = nextDate;
      this.entries = _buildEntries(courses, nextDate);
    } else {
      date = start;
      this.entries = entries;
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
        entries.add(AgendaEntry(
            course: course, recurringTime: time, concreteDate: date));
      }
    }
  }

  return entries;
}
