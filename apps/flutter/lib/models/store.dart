import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:class_companion/database.dart';
import 'package:class_companion/models/absence.dart';
import 'package:class_companion/models/agenda.dart';
import 'package:class_companion/models/course.dart';
import 'package:class_companion/models/semester.dart';
import 'package:class_companion/models/substitution.dart';
import 'package:class_companion/models/user.dart';
import 'package:class_companion/openapi.dart';
import 'package:class_companion/util/date_util.dart';
import 'package:class_companion/util/list_util.dart';
import 'package:drift/drift.dart';
import 'package:encrypt/encrypt.dart';
import 'package:flutter/material.dart' hide Key;
import 'package:mobx/mobx.dart';
import 'package:path_provider/path_provider.dart';

part 'store.g.dart';

class GlobalStore = _GlobalStore with _$GlobalStore;

abstract class _GlobalStore with Store {
  @observable
  User currentUser;

  @observable
  String licenseKey;

  @observable
  List<Absence> absences = [];

  @observable
  List<Course> courses = [];

  @observable
  List<Semester> semesters = [];

  @observable
  Agenda agenda = Agenda(start: DateTime.now(), courses: []);

  _GlobalStore({
    required this.currentUser,
    required this.licenseKey,
  }) {
    Timer.periodic(const Duration(seconds: 5), (timer) {
      save();
    });

    // React on every change
    autorun((_) {
      save();
      toJson();
    });
  }

  Future<void> init() async {
    db.select(db.absences).watch().listen((event) {
      absences = event;
    });

    db.select(db.courses).watch().listen((event) async {
      courses = event;

       await _updateAgenda();

      // // TOOD: This is temporary
      // final entry = agenda.entries.first;
      // substitutionPlans.add(
      //   SubstitutionPlan(
      //     date: DateTime.now().startOfDay,
      //     substitutions: [
      //       Substitution(
      //         type: SubstitutionType.cancelled,
      //         agendaEntry: entry,
      //       ),
      //     ],
      //   ),
      // );
    });

    db.select(db.semesters).watch().listen((event) {
      semesters = event;
    });

    final currentSemesterId = getCurrentSemesterId();
    final currentSemester = await (db.select(db.semesters)
          ..where((tbl) => tbl.id.equals(currentSemesterId)))
        .getSingleOrNull();
    if (currentSemester == null) {
      db
          .into(db.semesters)
          .insert(SemestersCompanion.insert(id: Value(currentSemesterId)));
    }
    semesters = await db.select(db.semesters).get();
    for (final semester in semesters) {
      await semester.courses.load();
    }
  }

  //// SEMESTERS ////

  Semester get currentSemester {
    final currentSemesterId = getCurrentSemesterId();
    final currentSemester = semesters
        .firstWhereOrNull((element) => element.id == currentSemesterId);
    if (currentSemester == null) {
      throw Exception("No current semester found");
    }
    return currentSemester;
  }

  //// ABSENCES ////

  @computed
  List<Absence> get unexcusedAbsences =>
      absences.where((element) => !element.isExcused).toList();

  @computed
  ObservableMap<DateTime, List<Absence>> get unexcusedAbsencesByDay {
    final map = <DateTime, List<Absence>>{};
    for (final absence in unexcusedAbsences) {
      if (map[absence.date] == null) {
        map[absence.date] = [];
      }
      map[absence.date]!.add(absence);
    }
    return map.asObservable();
  }

  //// AGENDA ////

  @action
  Future<void> _updateAgenda() async {
    final agenda = Agenda(
      start: DateTime.now(),
      courses: courses,
    );

    final date = agenda.date.add(agenda.date.timeZoneOffset).toUtc();
    final substitutions = await apiInstance.querySubstitutionsGet(date: date);

    if (substitutions == null) {
      this.agenda = agenda;
      return;
    }

    for (final sub in substitutions) {
      final startTime = sub.lessonStart;
      final index = startTime ~/ 2;

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

  @computed
  List<Agenda> get weeklyAgenda {
    final now = DateTime.now();
    final start = now.startOfWeek;

    final days = <DateTime>[];
    for (var i = 0; i < 5; i++) {
      days.add(start.add(Duration(days: i)));
    }

    return days
        .map((e) => Agenda(start: e, courses: courses, autoAdjust: false))
        .toList();
  }

  Agenda getAgendaForDay(DateTime day) =>
      Agenda(start: day, courses: courses, autoAdjust: false);

  //// PERSISTENCE ////

  // ignore: unused_element
  _GlobalStore.fromJson(Map<String, dynamic> json)
      : this(
          currentUser: User.fromJson(json["currentUser"]),
          licenseKey: json["licenseKey"],
        );

  Map<String, dynamic> toJson() {
    return {
      "currentUser": currentUser.toJson(),
      "licenseKey": licenseKey,
    };
  }

  Uint8List encrypt() {
    final cleartext = jsonEncode(this);
    final key = Key.fromUtf8("y\$B&E)H@McQfTjWn");
    final iv = IV.fromLength(16);

    final encrypter = Encrypter(AES(key));
    return encrypter.encrypt(cleartext, iv: iv).bytes;
  }

  Future<void> save() async {
    final directory = await getApplicationDocumentsDirectory();
    final storeFilePath = "${directory.path}/haukestore";
    final storeFile = File(storeFilePath);
    await storeFile.writeAsBytes(encrypt());
  }
}

String decrypt(Uint8List encryptedBytes) {
  final key = Key.fromUtf8("y\$B&E)H@McQfTjWn");
  final iv = IV.fromLength(16);
  final encrypter = Encrypter(AES(key));
  final encrypted = Encrypted(encryptedBytes);
  final decrypted = encrypter.decrypt(encrypted, iv: iv);
  return decrypted;
}

Future<GlobalStore?> loadStore() async {
  try {
    final directory = await getApplicationDocumentsDirectory();
    final storeFilePath = "${directory.path}/haukestore";
    final storeFile = File(storeFilePath);
    if (await storeFile.exists()) {
      final jsonContent = decrypt(await storeFile.readAsBytes());
      final store = GlobalStore.fromJson(jsonDecode(jsonContent));
      return store;
    }
  } catch (e, stacktrace) {
    debugPrint("Error while loading store: $e\n$stacktrace");
  }
  return null;
}
