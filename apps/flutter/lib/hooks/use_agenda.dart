import 'package:class_mate/business_domain/schedule/agenda.dart';
import 'package:class_mate/business_domain/time/weeks.dart';
import 'package:class_mate/models/course.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

Agenda? useAgendaForDay(DateTime day) {
  final courses = useCourses();
  final agenda = useMemoized(() {
    if (courses == null) {
      return null;
    }

    return Agenda(start: day, courses: courses, autoAdjust: false);
  }, [day, courses]);

  return agenda;
}

List<Agenda>? useWeeklyAgenda(WeekDef weekDef) {
  final courses = useCourses();

  return useMemoized(() {
    if (courses == null) {
      return null;
    }

    final days = getDaysInWeek(weekDef);

    return days
        .map((e) => Agenda(start: e, courses: courses, autoAdjust: false))
        .toList();
  }, [weekDef, courses]);
}
