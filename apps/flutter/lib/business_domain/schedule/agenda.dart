import 'dart:math';

import 'package:class_mate/models/agenda_entry.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/models/course_time.dart';
import 'package:class_mate/util/date_util.dart';

const lessonTimes = [
  TimeOfDay(hour: 8, minute: 0),
  TimeOfDay(hour: 9, minute: 45),
  TimeOfDay(hour: 11, minute: 30),
  TimeOfDay(hour: 13, minute: 50),
  TimeOfDay(hour: 15, minute: 15),
];

class AgendaTimeBlock {
  final AgendaEntry entry;
  final int column;
  int totalColumns;

  AgendaTimeBlock(this.entry, {required this.column, this.totalColumns = 1});
}

class Agenda {
  DateTime date;
  List<AgendaTimeBlock> blocks = [];

  List<AgendaEntry> get entries => blocks.map((e) => e.entry).toList();

  Agenda({
    required DateTime start,
    required List<Course> courses,
    bool autoAdjust = true,
    bool ignoreWeeks = false,
  }) : date = start.startOfDay {
    var entries = _buildEntries(courses, date, ignoreWeeks);
    final entriesAhead = entries.where((element) => !element.isOver);

    if (entriesAhead.isEmpty && autoAdjust) {
      date = _getNextRelevantDate(date);
      entries = _buildEntries(courses, date, ignoreWeeks);
    }

    if (entries.isEmpty) {
      return;
    }
    entries.sort((a, b) => a.start.compareTo(b.start));

    // Fill in empty slots, but not after the last entry of the day (which is the last entry of the list) or before the first lesson time of the day
    // TODO make this more efficient
    final lastEntry = entries.last;
    for (final time in lessonTimes) {
      if (time.isBefore(lastEntry.recurringTime.start) &&
          !entries.any((entry) => entry.recurringTime.start == time)) {
        final entry = AgendaEntry.empty(date, time);
        entries.add(entry);
      }
    }
    entries.sort((a, b) => a.start.compareTo(b.start));

    for (final entry in entries) {
      final overlappingBlocks = blocks
          .where((other) =>
              other.entry.recurringTime.start == entry.recurringTime.start ||
              other.entry.recurringTime.end == entry.recurringTime.end ||
              other.entry.start.isBefore(entry.end) &&
                  other.entry.end.isAfter(entry.start))
          .toList();

      final column = overlappingBlocks.isEmpty
          ? 0
          : overlappingBlocks.map((e) => e.column).reduce(max) + 1;
      for (final block in overlappingBlocks) {
        block.totalColumns = column + 1;
      }

      blocks.add(
          AgendaTimeBlock(entry, column: column, totalColumns: column + 1));
    }
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

List<AgendaEntry> _buildEntries(
    List<Course> courses, DateTime date, bool ignoreWeeks) {
  date = date.startOfDay;

  final currentWeekNumber = date.weekNumber;

  List<AgendaEntry> entries = [];
  for (final course in courses) {
    for (final time in course.courseTimes) {
      final matchesWeek = (time.weeks == CourseTimeWeek.both ||
          (time.weeks == CourseTimeWeek.even && currentWeekNumber.isEven) ||
          (time.weeks == CourseTimeWeek.odd && currentWeekNumber.isOdd));

      if (time.weekday == date.weekday && (ignoreWeeks || matchesWeek)) {
        final entry = AgendaEntry(
          course: course,
          recurringTime: time,
          concreteDate: date,
        );

        entries.add(entry);
      }
    }
  }

  return entries;
}

DateTime _getNextRelevantDate(DateTime date) {
  if (date.weekday == DateTime.friday) {
    return date.add(const Duration(days: 3));
  } else if (date.weekday == DateTime.saturday) {
    return date.add(const Duration(days: 2));
  } else {
    return date.add(const Duration(days: 1));
  }
}
