import 'package:class_mate/business_domain/schedule/agenda.dart';
import 'package:class_mate/business_domain/time/weeks.dart';
import 'package:class_mate/models/course.dart';
import 'package:flutter/cupertino.dart';
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

List<Agenda>? buildWeeklyAgenda(WeekDef weekDef, List<Course>? courses) {
  if (courses == null) {
    return null;
  }

  final days = getDaysInWeek(weekDef);

  return days
      .map((e) => Agenda(start: e, courses: courses, autoAdjust: false))
      .toList();
}

List<Agenda>? useWeeklyAgenda(WeekDef weekDef) {
  final courses = useCourses();

  final agenda = useState<List<Agenda>?>(null);

  useEffect(() {
    listener() {
      agenda.value = buildWeeklyAgenda(weekDef, courses);
    }

    listener();

    final listenable = courses == null ? null : Listenable.merge(courses);
    listenable?.addListener(listener);

    return () {
      listenable?.removeListener(listener);
    };
  }, [weekDef, courses]);

  return agenda.value;
}
