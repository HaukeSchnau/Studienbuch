import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:class_mate/database.dart';
import 'package:class_mate/error_catcher.dart';
import 'package:class_mate/models/agenda.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/models/substitution.dart';
import 'package:class_mate/models/user.dart';
import 'package:class_mate/openapi.dart';
import 'package:class_mate/router.dart';
import 'package:class_mate/util/date_util.dart';
import 'package:drift/drift.dart';
import 'package:encrypt/encrypt.dart';
import 'package:flutter/material.dart' hide Key;
import 'package:mobx/mobx.dart';
import 'package:path_provider/path_provider.dart';

part 'store.g.dart';

class GlobalStore = _GlobalStore with _$GlobalStore;

abstract class _GlobalStore with Store {
  final User user;

  @observable
  String licenseKey;

  @observable
  Agenda agenda = Agenda(start: DateTime.now(), courses: []);

  @observable
  List<Agenda> weeklyAgenda = [];

  @observable
  UpdateStoreCallback? updateStore;

  _GlobalStore(
      {required this.user,
      required this.licenseKey,
      // ignore: unused_element
      this.updateStore}) {
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
      throw UserException("Vertretungen konnten nicht geladen werden");
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

  //// PERSISTENCE ////

  // ignore: unused_element
  _GlobalStore.fromJson(Map<String, dynamic> json)
      : this(
          user: User.fromJson(json["currentUser"]),
          licenseKey: json["licenseKey"],
        );

  Map<String, dynamic> toJson() {
    return {
      "currentUser": user.toJson(),
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
    final storeFilePath = "${directory.path}/data";
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
    final storeFilePath = "${directory.path}/data";
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
