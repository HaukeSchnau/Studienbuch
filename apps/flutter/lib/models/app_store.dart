import 'dart:async';

import 'package:class_mate/database/database.dart';
import 'package:class_mate/error_catcher.dart';
import 'package:class_mate/models/agenda.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/models/substitution.dart';
import 'package:class_mate/openapi.dart';
import 'package:class_mate/util/date_util.dart';
import 'package:mobx/mobx.dart';

part 'app_store.g.dart';

class AppStore = _AppStore with _$AppStore;

abstract class _AppStore with Store {
  @observable
  Agenda agenda = Agenda(start: DateTime.now(), courses: []);

  @observable
  List<Agenda> weeklyAgenda = [];

  Future<void> init() async {
    createSemesterCoursesQuery().watch().listen((results) {
      final courses = results.map((e) => e.readTable(db.courses)).toList();
      _updateSubstitutedAgenda(courses);
      _updateWeeklyAgenda(courses);
    });
  }

  //// AGENDA ////

  @action
  Future<void> _updateSubstitutedAgenda(List<Course> courses) async {
    final agenda = Agenda(
      start: DateTime.now(),
      courses: courses,
    );

    final date = agenda.date.add(agenda.date.timeZoneOffset).toUtc();
    final substitutions = await apiInstance
        .querySubstitutionsGet(date: date)
        .catchError((e, stacktrace) {
      this.agenda = agenda;
      throw UserException("Vertretungen konnten nicht geladen werden", e);
    });

    if (substitutions == null) {
      this.agenda = agenda;
      return;
    }

    for (final sub in substitutions) {
      final lessonStart = sub.lessonStart;
      final index = lessonStart ~/ 2;

      if (index >= agenda.entries.length) {
        continue;
      }

      final agendaEntry = agenda.entries[index];

      if (agendaEntry.course?.id == sub.courseId) {
        agendaEntry.substitution = Substitution(
          type: typeMap[sub.type]!,
        );
      }
    }

    this.agenda = agenda;
  }

  @action
  void _updateWeeklyAgenda(List<Course> courses) {
    final start = agenda.date.startOfWeek;

    final days = <DateTime>[];
    for (var i = 0; i < 5; i++) {
      days.add(start.add(Duration(days: i)));
    }

    weeklyAgenda = days
        .map((e) => Agenda(start: e, courses: courses, autoAdjust: false))
        .toList();
  }
}

AppStore store = AppStore();
