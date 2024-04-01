import 'dart:async';

import 'package:class_mate/api/types.dart';
import 'package:class_mate/features/agenda/agenda.dart';
import 'package:class_mate/database/database.dart';
import 'package:class_mate/infrastructure/api.dart';
import 'package:class_mate/infrastructure/error_catcher.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/features/substitutions/substitution.dart';
import 'package:flutter/cupertino.dart';
import 'package:mobx/mobx.dart' hide Listenable;

part 'app_store.g.dart';

class AppStore = _AppStore with _$AppStore;

abstract class _AppStore with Store {
  @observable
  Agenda agenda = Agenda(start: DateTime.now(), courses: []);

  Future<void> init() async {
    createSemesterCoursesQuery().watch().listen((results) {
      final courses = results.map((e) => e.readTable(db.courses)).toList();

      final listenable = Listenable.merge(courses);
      listenable.addListener(() {
        _updateSubstitutedAgenda(courses);
      });

      _updateSubstitutedAgenda(courses);
    });
  }

  List<SubstitutionsGetOutput>? _substitutionsResponse;

  //// AGENDA ////

  @action
  Future<void> _updateSubstitutedAgenda(List<Course> courses) async {
    final agenda = Agenda(
      start: DateTime.now(),
      courses: courses,
    );

    final date = agenda.date.add(agenda.date.timeZoneOffset).toUtc();
    _substitutionsResponse ??=
        await api.substitutions.get(date: date).catchError((e, stacktrace) {
      this.agenda = agenda;
      throw UserException(
          "Vertretungen konnten nicht geladen werden", e, stacktrace);
    });

    if (_substitutionsResponse == null) {
      this.agenda = agenda;
      return;
    }

    for (final sub in _substitutionsResponse!) {
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
}

AppStore store = AppStore();
