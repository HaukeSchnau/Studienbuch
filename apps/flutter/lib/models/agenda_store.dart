import 'dart:async';

import 'package:class_mate/api/types.dart';
import 'package:class_mate/features/agenda/agenda.dart';
import 'package:class_mate/database/database.dart';
import 'package:class_mate/features/holidays/holidays.dart';
import 'package:class_mate/infrastructure/api.dart';
import 'package:class_mate/infrastructure/error_catcher.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/features/substitutions/substitution.dart';
import 'package:flutter/cupertino.dart';
import 'package:http/http.dart';
import 'package:mobx/mobx.dart' hide Listenable;
import 'package:sentry_flutter/sentry_flutter.dart';

part 'agenda_store.g.dart';

class AgendaStore = _AgendaStore with _$AgendaStore;

abstract class _AgendaStore with Store {
  @observable
  Agenda agenda = Agenda(start: DateTime.now(), courses: []);

  Future<void> init() async {
    createSemesterCoursesQuery().watch().listen((results) {
      final courses = results.map((e) => e.readTable(db.courses)).toList();

      final listenable = Listenable.merge(courses);
      listenable.addListener(() {
        buildAgenda(courses);
      });

      buildAgenda(courses);
      loadSubstitutionsForCurrentAgenda();
    });

    updateHolidays();
  }

  @observable
  ObservableList<SubstitutionsGetOutput>? substitutions;

  @computed
  bool get hasSubstitutionsLoaded => substitutions != null;

  @observable
  ObservableList<Holiday> holidays = ObservableList<Holiday>();

  @action
  Future<void> updateHolidays() async {
    holidays = (await fetchHolidays()).asObservable();
  }

  @action
  Future<void> loadSubstitutionsForCurrentAgenda(
      {bool reportNetworkError = true}) async {
    final date = agenda.date.add(agenda.date.timeZoneOffset).toUtc();

    try {
      final response = await api.substitutions.get(date: date);
      substitutions = response.asObservable();
    } on ClientException {
      if (reportNetworkError) {
        errorQueue.add(
          "Du bist offline. Vertretungen werden dir nicht angezeigt.",
        );
      }
    } catch (e, stacktrace) {
      errorQueue.add(
        "Vertretungen konnten nicht geladen werden.",
      );
      Sentry.captureException(e, stackTrace: stacktrace);
    }
  }

  @action
  void buildAgenda(List<Course> courses) {
    agenda = Agenda(
      start: DateTime.now(),
      courses: courses,
    );
  }

  @computed
  Agenda get substitutedAgenda {
    final agenda = this.agenda.copy();

    for (final entry in agenda.entries) {
      entry.substitution = null;
    }

    for (final sub in substitutions ?? <SubstitutionsGetOutput>[]) {
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

    return agenda;
  }
}

AgendaStore agendaStore = AgendaStore();
